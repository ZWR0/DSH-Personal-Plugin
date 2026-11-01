import assert from 'node:assert/strict'
import { BrowserAuth } from './packages/client/connection/src/browser-auth.ts'
import { RecordCredentials } from './browser-credentials.ts'
const auth = await BrowserAuth.create({}, new RecordCredentials(), 30)
const request = (url, cookie) => ({ method: 'GET', url, headers: {host:'example.tailnet.ts.net', ...(cookie === undefined ? {} : {cookie})} })
let status, headers
const response = {writeHead(s,h){status=s;headers=h},end(){}}
const token = auth.token()
const login = request('/?token='+token+'&private=never-log-this')
assert.equal(auth.authorizeIndex(login,response),false)
assert.equal(status,303)
assert.match(headers['set-cookie'],/SameSite=Strict/)
const cookie = headers['set-cookie'].split(';')[0]
assert.deepEqual(auth.diagnosticFacts(login),{path:'/',tokenPresent:true,tokenMatched:true,cookiePresent:false,cookieAuthenticated:false})
assert.equal(auth.authorizeIndex(request('/'),response),false)
assert.equal(status,401)
assert.equal(auth.authorizeIndex(request('/',cookie),response),true)
assert.equal(auth.diagnosticFacts(request('/api/remote.mux?private=never-log-this',cookie)).cookieAuthenticated,true)
assert.equal(auth.diagnosticFacts(request('/?token=wrong')).tokenMatched,false)
assert.equal(auth.diagnosticFacts(request('/?token='+token+'&token='+token)).tokenMatched,false)
assert.equal(auth.diagnosticFacts(request('/', 'invalid-cookie-secret')).cookieAuthenticated,false)
for(const req of [login,request('/',cookie),request('/api/test?secret=never-log-this','invalid-cookie-secret')]){
 const encoded=JSON.stringify(auth.diagnosticFacts(req))
 for(const secret of [token,cookie,'never-log-this','invalid-cookie-secret','?token=']) assert.equal(encoded.includes(secret),false)
}
console.log('PASS: exchange, missing-cookie redirect failure, normal-cookie login, API facts, mismatch, duplicate token, invalid cookie, redaction; real WebView not tested')
