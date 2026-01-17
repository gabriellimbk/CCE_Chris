const scenarioSelect = document.getElementById('scenarioSelect');
const scenarioTitle = document.getElementById('scenarioTitle');
const infoBtn = document.getElementById('infoBtn');
const resetBtn = document.getElementById('resetBtn');
const usBtn = document.getElementById('usBtn');
const chinaBtn = document.getElementById('chinaBtn');
const cambodiaBtn = document.getElementById('cambodiaBtn');
const respondBtn = document.getElementById('respondBtn');

const infoPopup = document.getElementById('popup-info');
const respondPopup = document.getElementById('popup-respond');
const feedbackPopup = document.getElementById('popup-feedback');
const usPopup = document.getElementById('popup-us');
const chinaPopup = document.getElementById('popup-china');
const cambodiaPopup = document.getElementById('popup-cambodia');

const infoTitle = document.getElementById('infoTitle');
const infoText = document.getElementById('infoText');
const respondTitle = document.getElementById('respondTitle');
const userResponse = document.getElementById('userResponse');
const sendBtn = document.getElementById('sendBtn');
const status = document.getElementById('status');
const soundOnBtn = document.getElementById('soundOnBtn');
const soundOffBtn = document.getElementById('soundOffBtn');

const API_BASE = window.location.origin;
const apiUrl = (path) => `${API_BASE}${path}`;

const feedbackTitle = document.getElementById('feedbackTitle');
const feedbackUsBtn = document.getElementById('feedbackUsBtn');
const feedbackChinaBtn = document.getElementById('feedbackChinaBtn');
const feedbackSingaporeBtn = document.getElementById('feedbackSingaporeBtn');
const feedbackCambodiaBtn = document.getElementById('feedbackCambodiaBtn');
const feedbackUs = document.getElementById('feedbackUs');
const feedbackChina = document.getElementById('feedbackChina');
const feedbackSingapore = document.getElementById('feedbackSingapore');
const feedbackCambodia = document.getElementById('feedbackCambodia');

const usLeaderText = document.getElementById('usLeaderText');
const chinaLeaderText = document.getElementById('chinaLeaderText');
const cambodiaLeaderText = document.getElementById('cambodiaLeaderText');

let scenarios = [];
let activeScenario = null;
let feedbackBlocks = null;
let ttsAudio = null;
let ttsAudioUrl = '';
let ttsController = null;
let ttsStopped = false;
let ttsNextAudio = null;
let ttsNextUrl = '';

if (soundOnBtn && soundOffBtn) {
  soundOnBtn.disabled = true;
  soundOffBtn.disabled = true;
}

function openPopup(popup) {
  popup.classList.add('open');
  popup.setAttribute('aria-hidden', 'false');
  if (popup === infoPopup && activeScenario) {
    startTts(activeScenario.scenario_text);
  }
}

function closePopup(popup) {
  popup.classList.remove('open');
  popup.setAttribute('aria-hidden', 'true');
}

function closeAllPopups() {
  [infoPopup, respondPopup, feedbackPopup, usPopup, chinaPopup, cambodiaPopup].forEach(closePopup);
}

function setSoundButtons(isPlaying) {
  if (!soundOnBtn || !soundOffBtn) return;
  soundOnBtn.hidden = isPlaying;
  soundOffBtn.hidden = !isPlaying;
}

function stopTts({ resetButtons = true } = {}) {
  ttsStopped = true;
  if (ttsController) {
    ttsController.abort();
    ttsController = null;
  }
  if (ttsAudio) {
    ttsAudio.pause();
    ttsAudio.src = '';
    ttsAudio = null;
  }
  if (ttsNextAudio) {
    ttsNextAudio.pause();
    ttsNextAudio.src = '';
    ttsNextAudio = null;
  }
  if (ttsAudioUrl) {
    URL.revokeObjectURL(ttsAudioUrl);
    ttsAudioUrl = '';
  }
  if (ttsNextUrl) {
    URL.revokeObjectURL(ttsNextUrl);
    ttsNextUrl = '';
  }
  if (resetButtons) {
    setSoundButtons(false);
  }
}

function splitIntoSentences(text) {
  return (text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

async function fetchTtsAudio(sentence, controller) {
  const res = await fetch(apiUrl('/api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sentence }),
    signal: controller.signal
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'TTS request failed.');
  }

  const audioBlob = await res.blob();
  const url = URL.createObjectURL(audioBlob);
  const audio = new Audio(url);
  return { audio, url };
}

async function playSentenceQueue(sentences) {
  for (let i = 0; i < sentences.length; i += 1) {
    if (ttsStopped) return;
    const controller = new AbortController();
    ttsController = controller;

    try {
      const currentSentence = sentences[i];
      if (!ttsAudio) {
        const current = await fetchTtsAudio(currentSentence, controller);
        ttsAudio = current.audio;
        ttsAudioUrl = current.url;
      }

      const nextSentence = sentences[i + 1];
      if (nextSentence && !ttsNextAudio) {
        fetchTtsAudio(nextSentence, controller)
          .then((next) => {
            if (ttsStopped) {
              next.audio.pause();
              URL.revokeObjectURL(next.url);
              return;
            }
            ttsNextAudio = next.audio;
            ttsNextUrl = next.url;
          })
          .catch(() => {});
      }

      await ttsAudio.play();
      await new Promise((resolve) => {
        ttsAudio.addEventListener('ended', resolve, { once: true });
      });

      if (ttsAudioUrl) {
        URL.revokeObjectURL(ttsAudioUrl);
      }
      ttsAudio = null;
      ttsAudioUrl = '';

      if (ttsNextAudio) {
        ttsAudio = ttsNextAudio;
        ttsAudioUrl = ttsNextUrl;
        ttsNextAudio = null;
        ttsNextUrl = '';
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        stopTts();
      }
      return;
    } finally {
      ttsController = null;
    }
  }

  stopTts();
}

async function startTts(text) {
  const sentences = splitIntoSentences(text);
  if (!sentences.length) return;
  stopTts({ resetButtons: false });
  ttsStopped = false;
  setSoundButtons(true);
  await playSentenceQueue(sentences);
}

function resetProgress(keepScenario = true) {
  stopTts();
  userResponse.value = '';
  status.textContent = '';
  feedbackBlocks = null;
  feedbackUs.textContent = '';
  feedbackChina.textContent = '';
  feedbackSingapore.textContent = '';
  feedbackCambodia.textContent = '';
  setActiveFeedback(null);
  closeAllPopups();

  if (!keepScenario) {
    scenarioSelect.selectedIndex = 0;
    scenarioTitle.textContent = 'Select a scenario';
    activeScenario = null;
    if (soundOnBtn && soundOffBtn) {
      soundOnBtn.disabled = true;
      soundOffBtn.disabled = true;
      setSoundButtons(false);
    }
  }
}

function setActiveFeedback(target) {
  [feedbackUs, feedbackChina, feedbackSingapore, feedbackCambodia].forEach((panel) => {
    panel.classList.remove('active');
  });
  if (target) {
    target.classList.add('active');
  }
}

function updateLeaderText(actorKey, element) {
  if (!activeScenario) {
    element.textContent = 'Select a scenario first.';
    return;
  }
  const actor = activeScenario.actors?.[actorKey];
  element.textContent = actor?.leader_address?.text || 'No address available.';
}

function applyScenario(scenario) {
  activeScenario = scenario;
  scenarioTitle.textContent = scenario.title;
  infoTitle.textContent = scenario.title;
  infoText.textContent = scenario.scenario_text;
  respondTitle.textContent = 'How will you respond as the Prime Minister of Singapore?';
  feedbackTitle.textContent = scenario.title;
  resetProgress(true);

  const showCambodia = Boolean(scenario.actors?.Cambodia);
  cambodiaBtn.style.display = showCambodia ? 'block' : 'none';
  feedbackCambodiaBtn.style.display = showCambodia ? 'block' : 'none';

  updateLeaderText('US', usLeaderText);
  updateLeaderText('China', chinaLeaderText);
  updateLeaderText('Cambodia', cambodiaLeaderText);
  if (soundOnBtn && soundOffBtn) {
    soundOnBtn.disabled = false;
    soundOffBtn.disabled = false;
  }

  openPopup(infoPopup);
}

function renderScenarioOptions() {
  scenarioSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose scenario';
  scenarioSelect.appendChild(placeholder);

  scenarios.forEach((scenario) => {
    const option = document.createElement('option');
    option.value = scenario.id;
    option.textContent = scenario.title;
    scenarioSelect.appendChild(option);
  });
}

function setFeedbackPanels(blocks) {
  feedbackUs.textContent = blocks?.us || 'No feedback yet.';
  feedbackChina.textContent = blocks?.china || 'No feedback yet.';
  feedbackSingapore.textContent = blocks?.singapore || 'No feedback yet.';
  feedbackCambodia.textContent = blocks?.cambodia || 'No feedback yet.';
}

function showFeedback(type) {
  if (!feedbackBlocks) {
    setFeedbackPanels(null);
  }

  if (type === 'us') {
    setActiveFeedback(feedbackUs);
  } else if (type === 'china') {
    setActiveFeedback(feedbackChina);
  } else if (type === 'singapore') {
    setActiveFeedback(feedbackSingapore);
  } else if (type === 'cambodia') {
    setActiveFeedback(feedbackCambodia);
  }
}

async function loadScenarios() {
  const res = await fetch(apiUrl('/api/scenarios'));
  scenarios = await res.json();
  renderScenarioOptions();
  cambodiaBtn.style.display = 'none';
  feedbackCambodiaBtn.style.display = 'none';
}

scenarioSelect.addEventListener('change', (event) => {
  const selected = scenarios.find((scenario) => scenario.id === event.target.value);
  if (selected) {
    applyScenario(selected);
  }
});

infoBtn.addEventListener('click', () => {
  if (!activeScenario) return;
  openPopup(infoPopup);
});

respondBtn.addEventListener('click', () => {
  if (!activeScenario) return;
  openPopup(respondPopup);
});

usBtn.addEventListener('click', () => {
  if (!activeScenario) return;
  updateLeaderText('US', usLeaderText);
  openPopup(usPopup);
});

chinaBtn.addEventListener('click', () => {
  if (!activeScenario) return;
  updateLeaderText('China', chinaLeaderText);
  openPopup(chinaPopup);
});

cambodiaBtn.addEventListener('click', () => {
  if (!activeScenario) return;
  updateLeaderText('Cambodia', cambodiaLeaderText);
  openPopup(cambodiaPopup);
});

resetBtn.addEventListener('click', () => {
  resetProgress(true);
});

if (soundOnBtn && soundOffBtn) {
  soundOnBtn.addEventListener('click', () => {
    if (!activeScenario) return;
    startTts(activeScenario.scenario_text);
  });

  soundOffBtn.addEventListener('click', () => {
    stopTts();
  });
}

sendBtn.addEventListener('click', async () => {
  status.textContent = '';
  if (!activeScenario) {
    status.textContent = 'Select a scenario first.';
    return;
  }

  const responseText = userResponse.value.trim();
  if (!responseText) {
    status.textContent = 'Type a response first.';
    return;
  }

  sendBtn.disabled = true;
  status.textContent = 'Sending to Gemini...';

  try {
    const res = await fetch(apiUrl('/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioId: activeScenario.id,
        userResponse: responseText
      })
    });

    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.error || 'Something went wrong.';
      return;
    }

    feedbackBlocks = data.blocks || null;
    setFeedbackPanels(feedbackBlocks);
    showFeedback('singapore');
    closePopup(respondPopup);
    openPopup(feedbackPopup);
    status.textContent = 'Feedback ready.';
  } catch (err) {
    status.textContent = 'Request failed.';
  } finally {
    sendBtn.disabled = false;
  }
});

feedbackUsBtn.addEventListener('click', () => showFeedback('us'));
feedbackChinaBtn.addEventListener('click', () => showFeedback('china'));
feedbackSingaporeBtn.addEventListener('click', () => showFeedback('singapore'));
feedbackCambodiaBtn.addEventListener('click', () => showFeedback('cambodia'));

Array.from(document.querySelectorAll('.popup-close')).forEach((btn) => {
  btn.addEventListener('click', () => {
    stopTts();
    const popupId = btn.getAttribute('data-close');
    if (popupId) {
      closePopup(document.getElementById(popupId));
    }
  });
});

loadScenarios();

