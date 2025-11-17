// js/audioBuilder.js
function buildAudioSequenceForNumber(number, mediaBaseUrl = "/assets/audio/") {
  // mediaBaseUrl ends with slash
  const numbersBase = mediaBaseUrl + "numbers/";
  const baseBase = mediaBaseUrl + "base/";
  if (number === 0) return [baseBase + "zero.mp3"];
  const seq = [];
  const andFile = baseBase + "and.mp3";
  const onClient = baseBase + "on_al_client.mp3";
  seq.push(onClient);

  function pushBelow100(n) {
    if (n === 0) return;
    if (n < 20) {
      seq.push(numbersBase + n + ".mp3");
    } else {
      const tens = Math.floor(n / 10) * 10;
      const units = n % 10;
      if (units === 0) {
        seq.push(numbersBase + tens + ".mp3");
      } else {
        seq.push(numbersBase + units + ".mp3");
        seq.push(andFile);
        seq.push(numbersBase + tens + ".mp3");
      }
    }
  }

  if (number < 100) {
    pushBelow100(number);
  } else if (number < 1000) {
    const hundreds = Math.floor(number / 100) * 100;
    const remainder = number % 100;
    seq.push(numbersBase + hundreds + ".mp3");
    if (remainder !== 0) {
      seq.push(andFile);
      pushBelow100(remainder);
    }
  } else {
    const thousands = Math.floor(number / 1000);
    const rest = number % 1000;
    seq.push(numbersBase + thousands + ".mp3");
    seq.push(numbersBase + "1000.mp3");
    if (rest !== 0) {
      seq.push(andFile);
      if (rest < 100) pushBelow100(rest);
      else {
        const hundreds = Math.floor(rest / 100) * 100;
        const remainder = rest % 100;
        seq.push(numbersBase + hundreds + ".mp3");
        if (remainder !== 0) {
          seq.push(andFile);
          pushBelow100(remainder);
        }
      }
    }
  }

  // caller should append go_to_clinic + clinic prompt file if desired
  return seq;
}
