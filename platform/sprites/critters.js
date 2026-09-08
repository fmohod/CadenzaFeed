// critters.js -- the Cadenza Arthouse animal roster and its pixel painter.
// GENERATED 2026-09-07 19:02 by CAMT jobs/flutie_publish.py from jobs/flute.py; edit THERE.
// One painter, every game (owner ruling 2026-09-07): Flutie Cats and the world
// draw the same seven real animals from this file. Facts per animal are
// accuracy constraints from life (Flutie Cats README), not style choices.
(function () {
// The roster is CONTENT: the owner's real animal friends (ruling
// 2026-08-29, FUTURE_IDEAS "Characters"; appearance facts in the Flutie
// Cats README table). Every drawn detail below is an accuracy constraint
// from life, not a style choice. All seven are selectable for now --
// the Crossy-Road unlock progression is future design, and the one
// mystery slot keeps that promise visible (Lulu waits on consent).
// scale enforces the real height order: Xica smallest -> Rocco -> cats
// -> Star -> Ella.
const CHARS = [
  // Rocco leads, by the owner's ruling. The real dog sang along when
  // Frankie played flute and sat through hours of piano -- the first
  // character everyone gets is the one who always answered the music.
  // NO TAIL (docked in life; never drawn), one big radar ear plus a
  // small flop, tricolor. In memoriam. He gets to keep running.
  {id:"rocco", name:"Rocco", sub:"the good boy · sings along", unlocked:true,
   scale:.8, accent:"#b06e2e", body:"#26221f", tan:"#b06e2e", bib:"#f2f0ea",
   ears:"radar", tailStyle:"none"},
  {id:"star", name:"Star", sub:"the grinner", unlocked:true,
   scale:1, accent:"#6fa8dc", body:"#5f7180", patch:"#f2f0ea",
   ears:"flop", tailStyle:"curlUp", tongue:"#e8839b"},
  // Black mouth cur, a year old, big, wrecks the house daily. Her dad's
  // word is "untrained"; the owner's is "free spirit" -- the owner's
  // read is the character.
  {id:"ella", name:"Ella", sub:"the free spirit", unlocked:true,
   scale:1.06, accent:"#c49a5e", body:"#c49a5e", dark:"#3a2e24",
   ears:"point", tailStyle:"sickle"},
  {id:"xica", name:"Xica", sub:"tail up · smallest", unlocked:true,
   scale:.6, accent:"#9fb2c4", body:"#7e8b99",
   ears:"cat", tailStyle:"hookUp"},
  {id:"elvis", name:"Elvis", sub:"the tuxedo", unlocked:true,
   scale:.84, accent:"#e8e6e3", body:"#1b1d20", bib:"#f2f0ea",
   eye:"#b7c94a", ears:"cat", tailStyle:"taper"},
  // Randy is a young man (~1 year); Smokey is a full-grown mama, older,
  // a litter behind her and a belly to show for it -- she outsizes him.
  {id:"randy", name:"Randy Boy", sub:"the handsome young man", unlocked:true,
   scale:.84, accent:"#e8963f", body:"#d98a3a", dark:"#a4561e",
   chin:"#f2f0ea", ears:"cat", tailStyle:"taper"},
  {id:"smokey", name:"Smokey", sub:"plume tail · mama", unlocked:true,
   scale:.93, accent:"#a7acb4", body:"#878c94", light:"#a7acb4",
   eye:"#e0bd45", ears:"cat", tailStyle:"plume", belly:true},
  {id:"slot8", name:"???", sub:"a friend's yes away", unlocked:false,
   body:"#3a4148"},
];

// Parametric pixel painter: one function, seven real animals. Side view
// facing right, centered on (0,0), r = half the body height-ish; every
// coordinate is in u = r/8 grid cells so the critters stay blocky at any
// size. Draw order back-to-front: tail, far legs, body, coat details,
// chest, head furniture, near legs.
function drawCritter(cx, ch, r, dead, fluteUp){
  const u = r/8;
  const C = c => dead ? "#d07070" : c;          // whole critter flushes red
  const D = c => dead ? "#b25c5c" : c;
  const R = (x,y,w,h,c) => { cx.fillStyle=c; cx.fillRect(x*u,y*u,w*u,h*u); };
  const body = C(ch.body), dark = D(ch.dark||ch.body),
        lite = C(ch.light||ch.body), white = C("#f2f0ea");
  switch (ch.tailStyle){                         // tails live behind
    case "none": break;                          // Rocco: never, ever
    case "curlUp":                               // Star: long, upward curl
      R(-11,-1,3,2,body); R(-12,-4,2,4,body); R(-11,-6,3,2,body); break;
    case "sickle":                               // Ella: over the back
      R(-10,-4,2,5,body); R(-9,-6,3,2,body); R(-7,-8,3,2,dark); break;
    case "hookUp":                               // Xica: a question mark
      R(-9,-11,2,11,body); R(-8,-13,4,2,body); R(-5,-12,2,2,body); break;
    case "plume":                                // Smokey: magnificent
      R(-15,-3,3,6,body); R(-13,-5,4,9,lite); R(-10,-4,2,8,body); break;
    default:                                     // taper (Elvis, Randy)
      R(-11,-1,3,2,body); R(-13,-4,2,4,body);
      if (ch.dark) R(-13,-3,2,1,dark);           // Randy: a tail ring
  }
  const legC = C(ch.tan||ch.body);
  R(-7,5,2,5,legC); R(-3,5,2,5,legC);            // legs
  R( 2,5,2,5,legC); R( 6,5,2,5,legC);
  if (ch.id==="elvis"){                          // white paws
    R(-7,8.6,2,1.4,white); R(-3,8.6,2,1.4,white);
    R( 2,8.6,2,1.4,white); R( 6,8.6,2,1.4,white);
  }
  R(-8,-6,16,12,body);                           // the body block
  if (ch.belly) R(-5,6,9,1.6,body);              // Smokey: the mama belly
  if (ch.id==="randy"){                          // classic tabby stripes
    R(-6,-6,2,9,dark); R(-2,-6,2,10,dark); R(2,-6,2,9,dark); R(6,-6,1,4,dark);
  }
  if (ch.id==="smokey"){                         // shaggy coat + chest ruff
    R(-8,4,2,2,lite); R(-4,4,2,2,lite); R(0,4,2,2,lite); R(4,4,2,2,lite);
    R(5,-3,3,7,lite);
  }
  if (ch.bib) R(5,-2,3,8,C(ch.bib));             // white chest bib
  if (ch.patch) R(5.5,1.5,2.5,4.5,C(ch.patch));  // Star: SMALL chest patch
  R(8,-5,2.6,3.6,ch.id==="ella"?dark:body);      // muzzle (Ella: black mask)
  if (ch.id==="ella") R(6,-6,2,4,dark);          //   the mask reaches back
  if (ch.id==="rocco"||ch.id==="elvis")          // white muzzle / blaze
    R(8.6,-4.2,2,2.8,white);
  if (ch.chin) R(8.4,-2.2,2.2,1.2,C(ch.chin));   // Randy: white chin
  if (ch.tongue){                                // Star: open-mouth grin
    R(8.8,-1.4,1.8,1,D("#2a2226")); R(9.2,-.6,1.4,2.2,C(ch.tongue));
  }
  cx.fillStyle = body; cx.beginPath();           // ears, per style
  if (ch.ears==="radar"){                        // Rocco: one big dish...
    cx.moveTo(1.5*u,-6*u); cx.lineTo(4*u,-12.5*u); cx.lineTo(6.5*u,-6*u);
    cx.moveTo(-.5*u,-6*u); cx.lineTo(.5*u,-8.5*u); cx.lineTo(2*u,-6*u);
  } else if (ch.ears==="flop"){                  // Star: soft, barely-lifted
    cx.rect(.5*u,-7.6*u,2.6*u,2.2*u);            //   flaps -- floppy reads as
    cx.rect(5*u,-7.6*u,2.6*u,2.2*u);             //   LOW in pixel shorthand
  } else if (ch.ears==="point"){                 // Ella: big and upright
    cx.moveTo(1*u,-6*u); cx.lineTo(2.5*u,-11*u); cx.lineTo(4.5*u,-6*u);
    cx.moveTo(5*u,-6*u); cx.lineTo(6.5*u,-10.5*u); cx.lineTo(8*u,-6*u);
  } else {                                       // cat
    cx.moveTo(2*u,-6*u); cx.lineTo(3*u,-9*u); cx.lineTo(4.5*u,-6*u);
    cx.moveTo(5.5*u,-6*u); cx.lineTo(6.8*u,-9*u); cx.lineTo(8*u,-6*u);
  }
  cx.fill();
  if (ch.tan){                                   // Rocco: eyebrow + cheek
    R(4.6,-5.4,1.2,1.2,C(ch.tan)); R(7.6,-1.6,1.6,1.6,C(ch.tan));
  }
  R(5.6,-4.6,1.2,1.2,C(ch.eye||"#101214"));      // the eye
  if (fluteUp){                                  // sounding = flute raised
    R(9,-3.6,8,1.1,C("#c6ccd4"));                // (his tap-mode spec: press
    R(11,-3.9,1,0.6,C("#e8c860"));               // and the character plays,
    R(13.5,-3.9,1,0.6,C("#e8c860"));             // release and it lowers)
    R(16.6,-3.8,1.4,1.5,C("#c6ccd4"));
  }
}

  window.CADENZA_CRITTERS = { version: 1, CHARS: CHARS, drawCritter: drawCritter };
})();
