import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserLane } from '../aurum-desktop/mcp/browser.mjs'

const directory=mkdtempSync(join(tmpdir(),'aurum-video-'))
const server=createServer((_,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8')
  res.end(`<!doctype html><title>Video workflow acceptance</title><section role="region" aria-label="验收播放器" style="width:640px;height:360px;background:#181818;position:relative"><video muted playsinline style="width:100%;height:100%"></video><button aria-label="播放器全屏" style="position:absolute;bottom:10px;right:10px">全屏</button><button disabled aria-label="禁用播放器控件">禁用控件</button></section><script>
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
    const ctx=canvas.getContext('2d');let frame=0;
    setInterval(()=>{ctx.fillStyle=frame++%2?'#b18b32':'#262b2a';ctx.fillRect(0,0,320,180)},100);
    document.querySelector('video').srcObject=canvas.captureStream(10);
  </script>`)
})
const lane=new BrowserLane({env:{...process.env,WCU_BROWSER_APP:'edge',WCU_BROWSER_HEADLESS:'0',WCU_BROWSER_PROFILE:directory}})
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const url=`http://127.0.0.1:${server.address().port}/`
  const opened=await lane.run('set_value',{elementId:'new-tab',value:url,activate:true},{})
  const browserTab=opened.meta.opened.id
  const before=await lane.run('snapshot',{browserTab,maxNodes:100},{})
  assert.equal(before.meta.media.videos[0].paused,true)
  const found=await lane.run('find',{browserTab,query:'验收播放器',maxResults:10},{})
  assert.equal(found.meta.results.length,1)
  const elementId=found.meta.results[0].id
  const args={browserTab,elementId,action:'play_fullscreen',timeoutMs:15000}
  const result=await lane.run('invoke',args,{})
  assert.equal(result.meta.verification,'observed')
  assert.equal(result.meta.media.playerFullscreen,true)
  assert.equal(result.meta.media.paused,false)
  assert(result.meta.media.currentTime>0)
  const control=await lane.run('find',{browserTab,query:'播放器全屏',maxResults:10},{})
  assert.equal(control.meta.results.length,1)
  const again=await lane.run('invoke',{...args,elementId:control.meta.results[0].id},{})
  assert.deepEqual(again.meta.steps,['activated','playback-observed'])
  assert(again.meta.media.currentTime>result.meta.media.currentTime)
  const disabled=await lane.run('find',{browserTab,query:'禁用播放器控件',maxResults:10},{})
  assert.equal(disabled.meta.results.length,1)
  await assert.rejects(lane.run('invoke',{...args,elementId:disabled.meta.results[0].id},{}),/BROWSER_ELEMENT_DISABLED/)
  console.log('PASS: real visible browser starts paused video, enters player fullscreen, observes continuing playback, and does not toggle an already-playing fullscreen video')
}finally{
  await lane.shutdown()
  await new Promise(resolve=>server.close(resolve))
  await rm(directory,{recursive:true,force:true,maxRetries:50,retryDelay:100})
}
