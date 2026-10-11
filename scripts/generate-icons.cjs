const sharp = require('sharp');
const icon = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
 <radialGradient id="sky" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#3a1a7a"/><stop offset=".55" stop-color="#140a33"/><stop offset="1" stop-color="#05030f"/></radialGradient>
 <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c8" stop-opacity=".9"/><stop offset=".4" stop-color="#ffb43a" stop-opacity=".35"/><stop offset="1" stop-color="#ffb43a" stop-opacity="0"/></radialGradient>
 <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4cc"/><stop offset=".4" stop-color="#e6b85a"/><stop offset="1" stop-color="#8a5a1e"/></linearGradient>
 <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfe8ff"/><stop offset="1" stop-color="#8aa8ff"/></linearGradient>
</defs>
${bg ? '<rect width="1024" height="1024" fill="url(#sky)"/>' : ''}
<circle cx="512" cy="500" r="420" fill="url(#halo)"/>
${['#ff4fc3','#3dff8a','#ffb21e','#6fe8ff','#b46bff'].map((c,i)=>{const a=(-30+i*15)*Math.PI/180;return `<line x1="560" y1="520" x2="${560+Math.cos(a)*420}" y2="${520+Math.sin(a)*420}" stroke="${c}" stroke-width="26" stroke-linecap="round" opacity=".95"/>`}).join('')}
<line x1="90" y1="560" x2="470" y2="520" stroke="#fff6d8" stroke-width="30" stroke-linecap="round"/>
<circle cx="512" cy="510" r="250" fill="none" stroke="url(#gold)" stroke-width="34"/>
<g transform="translate(512 500)">
 <polygon points="0,-190 125,-25 75,170 -75,170 -125,-25" fill="url(#gem)" stroke="#3a4a7a" stroke-width="10" stroke-linejoin="round"/>
 <polygon points="0,-190 45,-25 0,170 -45,-25" fill="#fff" opacity=".55"/>
 <polygon points="-125,-25 125,-25 0,10" fill="#fff" opacity=".7"/>
</g></svg>`;
(async () => {
  await sharp(Buffer.from(icon(true))).png().toFile('assets/images/icon.png');
  await sharp(Buffer.from(icon(false))).resize(1024,1024).png().toFile('assets/images/adaptive-foreground.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#05030f' } }).png().toFile('assets/images/splash-bg.png');
  await sharp(Buffer.from(icon(false))).resize(512,512).png().toFile('assets/images/splash-icon.png');
  console.log('icons ok');
})();
