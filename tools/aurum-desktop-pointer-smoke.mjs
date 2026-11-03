import { TakeoverControl } from '../aurum-desktop/mcp/takeover.mjs';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const output = new URL('./.test-tmp/aurum-desktop/', import.meta.url);
mkdirSync(output, {recursive:true});
const control = new TakeoverControl({testMode:true});
try {
 await control.command('test_render_pointer',{path:fileURLToPath(new URL('aurum-pointer.png',output)),scale:3});
 await control.command('begin',{cursorIndicatorEnabled:true,indicatorEnabled:false});
 const on=await control.command('pointer_target',{x:400,y:300});
 if(!on.pointerVisible||!on.pointerClickThrough||on.cursorError) throw Error(JSON.stringify(on));
 const off=await control.command('configure',{cursorIndicatorEnabled:false});
 if(off.pointerVisible) throw Error('Pointer remained visible after switch-off');
 console.log(JSON.stringify({pointerOn:on.pointerVisible,clickThrough:on.pointerClickThrough,pointerOff:!off.pointerVisible,cursorError:on.cursorError}));
} finally { await control.close(); }
