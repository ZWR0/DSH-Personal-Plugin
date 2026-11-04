const flatten = node => node ? [node, ...(node.children ?? []).flatMap(flatten)] : [];
const seconds = name => {
  const match = /\b(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*\d{1,2}:\d{2}/.exec(name ?? '');
  return match ? match[1].split(':').reduce((total, part) => total * 60 + Number(part), 0) : null;
};

/**
 * Operate one observed native player without toggling ambiguous controls.
 * @param {object} args Validated player id, window target and deadline.
 * @param {Function} run Native action dispatcher bound to this tool request.
 * @param {object} request Cancellation state owned by the MCP request.
 * @returns {Promise<object>} Observed advancing playback in player fullscreen.
 */
export async function playNativeFullscreen(args, run, request) {
  const target = Object.fromEntries(['nativeWindowHandle', 'processId', 'windowTitle'].filter(key => typeof args[key]==='string'?args[key].trim().length>0:args[key]!==undefined).map(key => [key, args[key]]));
  if (!Object.keys(target).length) throw Error('VIDEO_TARGET_REQUIRED: Specify the observed player window together with elementId.');
  const deadline = Date.now() + args.timeoutMs;
  const steps = [];
  let playerName, windowName;
  const check = () => { if (request?.cancelled) throw Error('COMPUTER_USE_CANCELLED'); if(Date.now()>=deadline)throw Error('VIDEO_WORKFLOW_TIMEOUT: Deadline expired; observe the player before retrying because an earlier action may have taken effect.'); };
  const observe = async () => {
    check();
    const tree = await run('tree', { ...target, maxDepth: 12, maxNodes: 1500 });
    check();
    windowName ??= tree.tree?.name;
    if(tree.tree?.name!==windowName)throw Error('VIDEO_TARGET_CHANGED: The window now shows different content. Re-read the intended video before retrying.');
    const all = flatten(tree.tree);
    let candidates = all.filter(item => item.id === args.elementId);
    if (!candidates.length && playerName) candidates=all.filter(item=>item.name===playerName);
    if (candidates.length !== 1) throw Error('VIDEO_PLAYER_STALE: Re-read the intended player; it disappeared or became ambiguous.');
    const player = candidates[0];
    if (["Window","Document"].includes(player.controlType)) throw Error("VIDEO_PLAYER_REQUIRED: Select the player container, not the whole window or document.");
    playerName ??= player.name;
    const controls = flatten(player).filter(item => item.isOffscreen !== true);
    const times = [...new Set(controls.map(item => seconds(item.name)).filter(value => value !== null))];
    if (times.length !== 1) throw Error('VIDEO_PROGRESS_UNAVAILABLE: This player does not expose one reliable progress counter; use the browser lane instead of guessing playback.');
    const box = player.boundingBox, window = tree.displayBounds;
    if(!window)throw Error("VIDEO_DISPLAY_UNAVAILABLE: Target display bounds are unavailable; fullscreen cannot be verified.");
    const fillsWindow = box && Math.abs(box.x - window.x) <= 16 && Math.abs(box.y - window.y) <= 16 && Math.abs(box.width - window.width) <= 32 && Math.abs(box.height - window.height) <= 32;
    return { controls, time: times[0], fullscreen: Boolean(fillsWindow), player: { id: player.id, name: player.name } };
  };
  const button = (state, pattern) => {
    const matches = state.controls.filter(item => item.controlType === 'Button' && pattern.test(item.name ?? '') && item.isEnabled !== false);
    if (matches.length > 1) throw Error('VIDEO_CONTROL_AMBIGUOUS: More than one matching player control; re-read the player.');
    return matches[0];
  };
  const click = async control => {
    check();
    await run('click', { ...target, elementId: control.id, dispatch: 'foreground', activate: true });
    check();
  };
  check();
  await run('element_info', { ...target, elementId: args.elementId });
  check();
  await run('activate_window', { ...target, activate: true });
  steps.push('activated');
  let state = await observe();
  const start = state.time;
  const play = button(state, /^(播放|继续播放|Play|Resume)(?:\s*\([a-z]\))?$/i);
  if (play) { await click(play); steps.push('play-clicked'); state = await observe(); }
  while (state.time <= start && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
    state = await observe();
  }
  if (state.time <= start) throw Error('VIDEO_PLAYBACK_UNCONFIRMED: Progress did not advance. No blind play/pause toggle or fullscreen key was sent.');
  steps.push('playback-observed');
  if (!state.fullscreen) {
    const full = button(state, /^(全屏|进入全屏|Fullscreen|Enter fullscreen)(?:\s*\([a-z]\))?$/i);
    if (!full) throw Error('VIDEO_FULLSCREEN_CONTROL_MISSING: No unambiguous player fullscreen button; web fullscreen and F11 are not substitutes.');
    await click(full); steps.push('fullscreen-clicked');
    state = await observe();
  }
  const fullscreenTime = state.time;
  while ((!state.fullscreen || state.time <= fullscreenTime) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
    state = await observe();
  }
  if (!state.fullscreen || state.time <= fullscreenTime) throw Error('VIDEO_FULLSCREEN_UNCONFIRMED: The fullscreen click was sent once, but fullscreen bounds and continuing playback were not both observed. Re-read the player before retrying.');
  return { ok: true, action: 'play_fullscreen', verification: 'observed', evidence: 'native-player-bounds-and-advancing-progress', player: state.player, currentTime: state.time, steps };
}
