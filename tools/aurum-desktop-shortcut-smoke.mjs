import {TakeoverControl} from '../aurum-desktop/mcp/takeover.mjs';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const output = new URL('./.test-tmp/aurum-desktop/', import.meta.url);
mkdirSync(output, {recursive:true});
const c=new TakeoverControl({testMode:true});
try {
 const first=await c.command('begin',{indicatorEnabled:true,stopShortcut:'Ctrl+Alt+Q'});
 await c.command('test_render',{path:fileURLToPath(new URL('lingxi-shortcut-custom.png',output)),stopShortcut:'Ctrl+Alt+Q'});
 const next=await c.command('configure',{stopShortcut:'F8'});
 if(next.stopShortcut!=='F8'||next.windows<1)throw Error('Live shortcut update failed');
 await c.command('test_render',{path:fileURLToPath(new URL('lingxi-shortcut-default.png',output)),stopShortcut:'Esc'});
 console.log(JSON.stringify({customShortcut:first.stopShortcut,updatedShortcut:next.stopShortcut,visibleFrames:next.windows,clickThrough:next.overlayClickThrough}));
}finally{await c.close();}
