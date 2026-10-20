
/*
 DUDAS SILENCIOSAS
 App con Supabase, Gemini y programas PDF
*/

(() => {
"use strict";

const ROOT = document.getElementById("app");
const CFG = window.DS_CONFIG || {};

const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(
    CFG.supabaseUrl || ""
  ) &&
  /^(sb_publishable_|eyJ)/.test(
    CFG.supabasePublishableKey || ""
  );

const KIND = {
  error: "Posible error conceptual",
  proc: "Dificultad de procedimiento",
  duda: "Duda de contenido",
  otro: "Otra / logística"
};

const DEMO = [
  ["¿Por qué el 3 pasa dividiendo al otro lado?", "A"],
  ["No entiendo por qué lo que multiplica pasa dividiendo", "A"],
  ["¿El número siempre cambia de operación?", "A"],
  ["¿Qué significa hacer lo mismo en ambos lados?", "A"],
  ["¿Cuándo se invierte el signo?", "B"],
  ["Me confundo con los números negativos", "B"],
  ["Si tengo -2x = 8, ¿x queda negativo?", "B"],
  ["¿Qué hago si hay x en los dos lados?", "C"],
  ["¿Se pueden juntar las x de lados distintos?", "C"],
  ["¿Qué hago si hay paréntesis?", "C"],
  ["¿Cómo compruebo que mi resultado está bien?", "D"],
  ["¿Hay que reemplazar la x al final?", "D"],
  ["¿Se puede dividir por cero?", "E"],
  ["¿Qué pasa si queda 0 = 0?", "E"],
  ["¿Esto entra en el control?", "X"],
  ["¿Van a subir las diapositivas?", "X"]
];

const DDEFS = {
  A: {
    label: "Por qué pasa dividiendo",
    kind: "error",
    gap: "Posible confusión sobre operaciones equivalentes.",
    tip: "Explicar la ecuación como una balanza."
  },
  B: {
    label: "Signos y números negativos",
    kind: "proc",
    gap: "Dificultades al operar con números negativos.",
    tip: "Resolver ejemplos con signos diferentes."
  },
  C: {
    label: "Incógnitas en ambos lados",
    kind: "proc",
    gap: "Dudas sobre cómo reunir términos.",
    tip: "Resolver una ecuación paso a paso."
  },
  D: {
    label: "Comprobación de resultados",
    kind: "duda",
    gap: "Dudas sobre cómo verificar soluciones.",
    tip: "Sustituir la solución en la ecuación original."
  },
  E: {
    label: "Casos especiales",
    kind: "duda",
    gap: "Confusión sobre diferentes tipos de solución.",
    tip: "Comparar ecuaciones compatibles e incompatibles."
  },
  X: {
    label: "Preguntas administrativas",
    kind: "otro",
    gap: "Consultas sobre la organización de la clase.",
    tip: ""
  }
};

const STOP = new Set(
  "el la los las un una unos unas de del al a y o en por para con sin que se es son lo le como si no mas pero porque mi me tu ya hay esta este esto eso esa ese ser hace cuando tambien muy solo asi cual donde quien entiendo entendi duda dudas pregunta profe profesor clase quiero saber cosa cosas tengo tiene hacer puedo pueden estoy nosotros ustedes".split(" ")
);

const S = {
  view: "home",
  configured,
  ready: !configured,

  tc: null,
  sc: null,

  teacher: null,
  classes: [],
  cls: null,

  doubts: [],
  doubtTotal: 0,
  participants: 0,

  pulse: {
    yes: 0,
    no: 0,
    total: 0
  },

  student: null,
  studentSent: false,
  studentAnswer: null,
  studentSentCount: 0,

  demo: false,
  demoBusy: false,

  loading: false,
  actionBusy: false,
  aiBusy: false,
  ai: null,

  // Programa académico PDF
  program: null,
  programBusy: false,
  programError: "",
  programSelectedFile: null,

  channel: null,
  live: false,
  poll: null,
  queued: null,

  refreshBusy: false,
  refreshEpoch: 0,

  lastSyncAt: null,
  syncError: "",

  openTopic: null,
  projector: false,
  confirm: null,

  otpSent: false,
  notice: "",
  connectError: ""
};

const $ = selector =>
  document.querySelector(selector);

const esc = value =>
  String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );

const clean = (value, max = 400) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const fmt = value =>
  value
    ? new Date(value).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";

const dateFmt = value =>
  value
    ? new Date(value).toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "—";

const normal = value =>
  clean(value, 2000)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

const read = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value === null
      ? fallback
      : JSON.parse(value);
  } catch {
    return fallback;
  }
};

const store = (key, value) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {}
};

const delStore = key => {
  try {
    localStorage.removeItem(key);
  } catch {}
};

const slug = value =>
  clean(value, 40)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-") || "clase";

const classUrl = code =>
  location.origin +
  location.pathname +
  "#" +
  code;

const captchaEnabled = () =>
  !!(CFG.turnstileSiteKey || "").trim();

let captchaWidget = null;

function captchaToken() {
  if (!captchaEnabled()) return null;

  try {
    return captchaWidget !== null &&
      window.turnstile
      ? window.turnstile.getResponse(captchaWidget) || null
      : null;
  } catch {
    return null;
  }
}

function mountCaptcha() {
  if (
    !captchaEnabled() ||
    !window.turnstile ||
    captchaWidget !== null
  ) return;

  const spot = $("#ds-captcha");

  if (!spot) return;

  try {
    captchaWidget = window.turnstile.render(
      spot,
      {
        sitekey: CFG.turnstileSiteKey,
        theme: "auto",
        size: "flexible",
        language: "es"
      }
    );
  } catch (error) {
    console.warn(
      "No se pudo cargar el control anti-bots.",
      error
    );
  }
}

window.dsTurnstileLoaded = mountCaptcha;

const active = () =>
  S.cls && S.cls.status === "open";

const visibleDoubts = () =>
  S.doubts.filter(d => !d.hidden);

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// MENSAJES Y ESTADO
// ==========================================

function toast(message, error = false) {
  const element = document.createElement("div");

  element.className =
    "toast" + (error ? " err" : "");

  element.textContent = message;

  document
    .getElementById("toasts")
    .appendChild(element);

  setTimeout(
    () => element.remove(),
    error ? 6800 : 3400
  );
}

function errMessage(error) {
  const message = clean(
    error?.message || String(error),
    240
  );

  if (/invalid login credentials/i.test(message)) {
    return "Credenciales inválidas.";
  }

  if (/rate limit/i.test(message)) {
    return "Se alcanzó un límite temporal de solicitudes.";
  }

  if (/anonymous.*disabled/i.test(message)) {
    return "Activa Anonymous Sign-Ins en Supabase.";
  }

  if (/Failed to fetch|networkerror/i.test(message)) {
    return "No se pudo conectar a Supabase.";
  }

  return message || "Ocurrió un error inesperado.";
}

function status() {
  const element = $("#conn");

  if (!element) return;

  const label = !configured
    ? "Demo · sin configurar"
    : S.connectError
      ? "Error de conexión"
      : S.demo
        ? "Simulación"
        : S.live
          ? "En tiempo real"
          : S.ready
            ? "Servidor configurado"
            : "Conectando…";

  element.className =
    "conn " +
    (S.live
      ? "on"
      : S.connectError
        ? "off"
        : "wait");

  const target = element.querySelector("span");

  if (target) target.textContent = label;
}

// ==========================================
// INTERFAZ GENERAL
// ==========================================

function mount(html) {
  const saved = {};

  ROOT.querySelectorAll(
    "input[id],textarea[id]"
  ).forEach(element => {
    if (element.type !== "file") {
      saved[element.id] = element.value;
    }
  });

  const old = document.activeElement;
  const id = old?.id || null;

  let position = null;

  try {
    position = old.selectionStart;
  } catch {}

  const feed = ROOT.querySelector(".feed");
  const scroll = feed?.scrollTop || 0;

  if (
    captchaWidget !== null &&
    window.turnstile
  ) {
    try {
      window.turnstile.remove(captchaWidget);
    } catch {}

    captchaWidget = null;
  }

  ROOT.innerHTML = html;

  Object.entries(saved).forEach(
    ([key, value]) => {
      const destination =
        document.getElementById(key);

      if (
        destination &&
        destination.type !== "checkbox" &&
        destination.type !== "file"
      ) {
        destination.value = value;
      }
    }
  );

  if (id) {
    const element = document.getElementById(id);

    if (element) {
      try {
        element.focus({
          preventScroll: true
        });

        if (position !== null) {
          element.setSelectionRange(
            position,
            position
          );
        }
      } catch {}
    }
  }

  const newFeed =
    ROOT.querySelector(".feed");

  if (newFeed) {
    newFeed.scrollTop = scroll;
  }

  const box = $("#qrbox");

  if (box && S.cls && !S.demo) {
    const url = classUrl(S.cls.code);

    try {
      if (window.QRCode) {
        new window.QRCode(box, {
          text: url,
          width: 220,
          height: 220,
          colorDark: "#0f1a1d",
          colorLight: "#ffffff"
        });
      } else {
        box.textContent =
          "Comparte el enlace de la clase.";
      }
    } catch {
      box.textContent =
        "Comparte el enlace indicado.";
    }
  }

  mountCaptcha();
  status();
}

function render() {
  let html = "";

  if (S.view === "home") {
    html = viewHome();
  } else if (S.view === "teacher") {
    html = viewTeacher();
  } else if (S.view === "dash") {
    html = viewDash();
  } else if (S.view === "student") {
    html = viewStudent();
  } else {
    html = viewHome();
  }

  if (S.projector && S.cls && !S.demo) {
    html += viewProjector();
  }

  if (S.confirm) {
    html += `
      <div class="modal-wrap"
        role="dialog"
        aria-modal="true">

        <div class="modal">

          <h2>${esc(S.confirm.title)}</h2>
          <p>${esc(S.confirm.message)}</p>

          <div class="row"
            style="justify-content:flex-end">

            <button class="btn"
              data-act="cancelConfirm">
              Cancelar
            </button>

            <button
              class="btn ${
                S.confirm.danger
                  ? "danger"
                  : "primary"
              }"
              data-act="acceptConfirm">
              ${esc(S.confirm.ok)}
            </button>

          </div>
        </div>
      </div>
    `;
  }

  mount(html);
}

// ==========================================
// PANTALLA DE INICIO
// ==========================================

function viewHome() {
  const joinHash =
    location.hash.slice(1).toUpperCase();

  const hinted =
    /^[A-HJ-NP-Z2-9]{6}$/.test(joinHash)
      ? joinHash
      : "";

  return `
    <section class="stack"
      style="max-width:790px">

      <span class="eyebrow">
        FCFM · Universidad de Chile · Educación con IA
      </span>

      <h1>
        Lo que el curso no dice en voz alta,
        a tiempo para enseñar.
      </h1>

      <p class="muted">
        Los estudiantes comparten dudas
        sin identificarse ante el profesor.
        El tablero reúne temas recurrentes
        y ayuda a decidir qué explicar nuevamente.
      </p>

    </section>

    ${!configured ? `
      <div class="alert"
        style="margin-top:18px">
        Falta configurar Supabase.
      </div>
    ` : ""}

    ${S.connectError ? `
      <div class="alert">
        ${esc(S.connectError)}
      </div>
    ` : ""}

    <div class="home">

      <section class="card raised stack">

        <span class="eyebrow">
          Participar
        </span>

        <h2>Soy estudiante</h2>

        <p class="small muted">
          Ingresa el código de la clase
          o escanea el QR.
          No necesitas escribir tu nombre.
        </p>

        <form class="stack" data-form="join">

          <label class="f">
            Código de seis caracteres

            <input
              id="join-code"
              class="code-input"
              maxlength="6"
              type="text"
              placeholder="ABC234"
              value="${esc(hinted)}"
              autocomplete="off"
              required
            >
          </label>

          ${captchaEnabled()
            ? `<div id="ds-captcha"></div>`
            : ""}

          <button
            class="btn primary big"
            type="submit"
            ${!configured || S.actionBusy
              ? "disabled"
              : ""}>

            ${S.actionBusy
              ? "Conectando…"
              : "Entrar a la clase"}

          </button>

        </form>
      </section>

      <section class="card raised stack">

        <span class="eyebrow">
          Gestionar
        </span>

        <h2>Soy profesor/a</h2>

        <p class="small muted">
          Accede con tu correo autorizado
          para crear clases y revisar dudas.
        </p>

        <button
          class="btn primary big"
          data-act="teacher"
          ${!configured ? "disabled" : ""}>

          ${S.teacher
            ? "Abrir mis clases"
            : "Acceder como profesor"}

        </button>

        <button
          class="btn big"
          data-act="demo">
          Explorar una clase de ejemplo
        </button>

      </section>
    </div>

    <div class="card stack"
      style="margin-top:20px">

      <h3>Privacidad</h3>

      <p class="small muted">
        Las dudas se guardan en Supabase.
        El profesor no recibe nombres asociados
        a ellas. El análisis pedagógico utiliza
        Gemini cuando el docente lo solicita.
        Evita incluir datos personales.
      </p>

    </div>
  `;
}

// ==========================================
// ACCESO DOCENTE
// ==========================================

function viewTeacher() {
  if (!configured) return viewHome();

  if (!S.teacher) {
    return `
      <div class="stack"
        style="max-width:540px;margin:0 auto">

        <button
          class="btn ghost sm"
          data-act="home">
          ← Volver
        </button>

        <span class="eyebrow">
          Acceso docente
        </span>

        <h1>Tu espacio de clases</h1>

        <div class="card stack">

          <h2>Entrar con correo</h2>

          <p class="muted small">
            Recibirás un enlace para iniciar
            sesión con tu correo autorizado.
          </p>

          <form
            class="stack"
            data-form="login">

            <label class="f">
              Correo electrónico

              <input
                id="email"
                type="email"
                autocomplete="email"
                placeholder="profesor@universidad.cl"
                required
              >
            </label>

            ${captchaEnabled()
              ? `<div id="ds-captcha"></div>`
              : ""}

            <button
              class="btn primary big"
              type="submit"
              ${S.actionBusy
                ? "disabled"
                : ""}>

              ${S.actionBusy
                ? "Enviando…"
                : "Enviar enlace de acceso"}

            </button>
          </form>

          ${S.otpSent
            ? `<div class="notice">
                 Revisa tu correo y spam.
               </div>`
            : ""}

        </div>
      </div>
    `;
  }

  return `
    <div class="stack"
      style="max-width:850px;margin:0 auto">

      <div class="row"
        style="justify-content:space-between">

        <div>
          <span class="eyebrow">
            Panel docente
          </span>

          <h1>Mis clases</h1>

          <p class="muted small">
            ${esc(S.teacher.email || "")}
          </p>
        </div>

        <button
          class="btn sm"
          data-act="logout">
          Cerrar sesión
        </button>
      </div>

      <form
        data-form="create"
        class="card stack">

        <h2>Crear una clase</h2>

        <label class="f">
          Nombre del curso

          <input
            id="c-title"
            type="text"
            maxlength="80"
            minlength="3"
            placeholder="MA1101 Cálculo I"
            required
          >
        </label>

        <label class="f">
          Tema de hoy

          <input
            id="c-topic"
            type="text"
            maxlength="160"
            placeholder="Integrales"
          >
        </label>

        <button
          class="btn primary"
          type="submit"
          ${S.actionBusy ? "disabled" : ""}>

          ${S.actionBusy
            ? "Creando…"
            : "Crear clase y abrir tablero"}

        </button>
      </form>

      <div class="card stack">

        <div class="row"
          style="justify-content:space-between">

          <h2>Clases guardadas</h2>

          <button
            class="btn sm"
            data-act="refreshClasses">
            Actualizar
          </button>
        </div>

        ${S.classes.length
          ? S.classes.map(c => `
              <div class="sess">

                <div class="t">
                  <b>${esc(c.title)}</b>

                  <div class="small muted">
                    ${esc(c.code)}
                    · ${esc(c.topic || "Sin tema")}
                    · ${c.status === "closed"
                      ? "Terminada"
                      : "Abierta"}
                  </div>
                </div>

                <button
                  class="btn sm primary"
                  data-act="openClass"
                  data-id="${esc(c.id)}">
                  Abrir
                </button>

                <button
                  class="btn sm danger"
                  data-act="deleteClass"
                  data-id="${esc(c.id)}">
                  Borrar
                </button>

              </div>
            `).join("")
          : `<p class="muted small">
               Todavía no tienes clases.
             </p>`}

      </div>
    </div>
  `;
}

// ==========================================
// ESTUDIANTE
// ==========================================

function viewStudent() {
  const st = S.student;

  if (!st) return viewHome();

  const closed = st.status !== "open";

  const answerKey =
    `ds_pulse_${st.id}_${st.pulse_version}`;

  const answered = read(answerKey, null);

  return `
    <div class="stu">

      <div class="row"
        style="justify-content:space-between">

        <div>
          <span class="eyebrow">
            Clase ${esc(st.code)}
          </span>

          <h2>${esc(st.title)}</h2>

          ${st.topic
            ? `<p class="small muted">
                 ${esc(st.topic)}
               </p>`
            : ""}
        </div>

        <button
          class="btn sm ghost"
          data-act="home">
          Salir
        </button>
      </div>

      ${closed
        ? `
          <div class="card sent">
            <div class="ok">✓</div>
            <h2>La clase terminó</h2>
            <p>Ya no recibe nuevas dudas.</p>
          </div>
        `
        : S.studentSent
          ? `
            <div class="card sent">

              <div class="ok">✓</div>
              <h2>Tu duda se envió</h2>

              <p class="muted">
                El docente la verá sin tu nombre.
              </p>

              <button
                class="btn primary"
                data-act="another">
                Escribir otra duda
              </button>

            </div>
          `
          : `
            <form
              data-form="doubt"
              class="card stack">

              <label class="f"
                for="d-text">

                <span style="
                  font:600 1.35rem var(--f-display)">
                  ¿Qué no te quedó claro?
                </span>

                <span class="hint">
                  Escribe tu duda
                  (5–400 caracteres).
                </span>
              </label>

              <textarea
                id="d-text"
                minlength="5"
                maxlength="400"
                required
                placeholder="¿Cómo se resuelve esta integral?"
              ></textarea>

              <button
                type="submit"
                class="btn primary big"
                ${S.actionBusy ? "disabled" : ""}>

                ${S.actionBusy
                  ? "Revisando y enviando…"
                  : "Enviar duda anónima"}

              </button>
            </form>
          `}

      ${st.pulse_version > 0
        ? `
          <div class="card stack">

            <span class="eyebrow">
              Chequeo de comprensión
            </span>

            <h3>
              ${esc(
                st.pulse_question ||
                "¿Quedó claro?"
              )}
            </h3>

            ${st.pulse_open
              ? `
                <div class="pulse-choices">

                  <button
                    data-act="pulseYes"
                    class="btn ${
                      answered === true
                        ? "primary"
                        : ""
                    }">
                    ✓ Sí, lo entendí
                  </button>

                  <button
                    data-act="pulseNo"
                    class="btn ${
                      answered === false
                        ? "primary"
                        : ""
                    }">
                    Todavía tengo dudas
                  </button>

                </div>
              `
              : `<p class="muted">
                   Esta comprobación terminó.
                 </p>`}
          </div>
        `
        : ""}

      <div class="notice">
        No incluyas datos personales.
        Las preguntas se revisan antes de enviarse.
        Máximo 12 dudas por participante.
      </div>

    </div>
  `;
}

// ==========================================
// NUEVO PANEL DE PDF
// ==========================================

function programPanel() {
  const program = S.program;

  const taxonomy =
    program?.taxonomy || null;

  const units =
    Array.isArray(taxonomy?.units)
      ? taxonomy.units
      : [];

  const totalTopics = units.reduce(
    (n, unit) =>
      n +
      (
        Array.isArray(unit.topics)
          ? unit.topics.length
          : 0
      ),
    0
  );

  return `
    <section
      class="card stack"
      style="margin-bottom:18px">

      <div class="row"
        style="justify-content:space-between">

        <div>
          <span class="eyebrow">
            Personalización con Gemini
          </span>

          <h2>Programa del curso (PDF)</h2>
        </div>

        <span class="pill ${
          program ? "live" : ""
        }">
          ${program
            ? "Programa analizado"
            : "Sin programa"}
        </span>

      </div>

      <p class="small muted">
        Sube el programa de tu asignatura
        para clasificar preguntas según
        sus unidades y subtemas.

        Las consultas administrativas
        se clasificarán por separado.
      </p>

      ${S.programError
        ? `
          <div class="alert">
            ${esc(S.programError)}
          </div>
        `
        : ""}

      ${program
        ? `
          <div class="notice">

            <b>Documento:</b>
            ${esc(program.file_name)}

            <p>
              ${units.length} unidades y
              ${totalTopics} subtemas identificados.
            </p>

          </div>

          ${taxonomy?.summary
            ? `
              <p class="small">
                ${esc(taxonomy.summary)}
              </p>
            `
            : ""}

          <details>

            <summary style="cursor:pointer">
              Ver temario detectado por Gemini
            </summary>

            <div class="stack"
              style="margin-top:12px">

              ${units.map(unit => `
                <div>
                  <b>${esc(unit.title)}</b>

                  <ul>
                    ${(unit.topics || [])
                      .map(topic => `
                        <li>
                          ${esc(topic.title)}
                        </li>
                      `)
                      .join("")}
                  </ul>
                </div>
              `).join("")}

            </div>
          </details>

        `
        : ""}

      <form
        class="stack"
        data-form="program">

        <label class="f">

          ${program
            ? "Reemplazar programa"
            : "Seleccionar programa"}

          <input
            id="ds-program-pdf"
            type="file"
            accept="application/pdf,.pdf"
            ${S.programBusy ? "disabled" : ""}
          >
        </label>

        ${S.programSelectedFile
          ? `
            <p class="small muted">
              Archivo seleccionado:
              ${esc(S.programSelectedFile.name)}
            </p>
          `
          : ""}

        <button
          class="btn primary"
          type="submit"
          ${S.programBusy ? "disabled" : ""}>

          ${S.programBusy
            ? "Analizando PDF con Gemini…"
            : "Subir y analizar con Gemini"}

        </button>
      </form>

      <p class="explain">
        Formato PDF, máximo 8 MB.
        El documento se almacena en
        Supabase Storage privado.
      </p>

    </section>
  `;
}

// ==========================================
// PANEL DOCENTE
// ==========================================

function viewDash() {
  const c = S.cls;

  if (!c) return viewTeacher();

  const ds = S.doubts;
  const live = visibleDoubts();
  const hidden = ds.length - live.length;

  const analysis = currentAnalysis(live);

  const source =
    analysis?.source || "local";

  const n = live.length;
  const answers = S.pulse;

  return `
    <div class="actionbar">

      <button
        class="btn sm ghost"
        data-act="backClasses">

        ← ${S.demo ? "Inicio" : "Mis clases"}

      </button>

      <span class="spacer"></span>

      <span class="pill ${S.demo ? "" : "live"}">
        ${S.demo
          ? "MODO DEMO"
          : c.status === "open"
            ? "CLASE ABIERTA"
            : "CLASE TERMINADA"}
      </span>

      <button
        class="btn sm"
        data-act="refreshDash">
        Actualizar
      </button>

      <button
        class="btn sm"
        data-act="csv">
        Exportar CSV
      </button>

      <button
        class="btn sm"
        data-act="report">
        Informe / PDF
      </button>

    </div>

    <div class="bar">

      <div class="codebox">
        <span class="small">
          Código de la clase
        </span>

        <span class="code">
          ${esc(c.code)}
        </span>
      </div>

      <div>
        <h2>${esc(c.title)}</h2>
        <p class="muted small">
          ${esc(c.topic || "Sin tema")}
        </p>
      </div>

      <div class="stat">
        <b class="tnum">${n}</b>

        <span class="small muted">
          Dudas visibles
        </span>

        <p class="small muted">
          ${hidden} ocultas ·
          ${S.participants} participantes
        </p>
      </div>

      <div class="row">

        ${!S.demo
          ? `
            <button
              class="btn"
              data-act="proj">
              Proyectar código
            </button>

            <button
              class="btn ${
                active() ? "danger" : ""
              }"
              data-act="toggleClass">

              ${active()
                ? "Terminar clase"
                : "Reabrir clase"}

            </button>
          `
          : `
            <button
              class="btn primary"
              data-act="simulate">
              Simular dudas
            </button>
          `}
      </div>
    </div>

    ${S.syncError
      ? `<div class="alert">
           ${esc(S.syncError)}
         </div>`
      : ""}

    ${S.loading
      ? `<p class="muted">
           Actualizando…
         </p>`
      : ""}

    ${!S.demo ? programPanel() : ""}

    <div class="dash">

      <section class="stack">

        ${analysisBlock(
          analysis,
          live,
          source
        )}

        <div class="card stack">

          <span class="eyebrow">
            Evaluación formativa
          </span>

          <h3>
            ¿Se percibe mayor claridad?
          </h3>

          ${S.demo
            ? `<p class="muted">
                 Modo demostración.
               </p>`
            : pulseBlock(c, answers)}

        </div>

      </section>

      <aside class="stack">

        <div class="card stack">

          <h3>Dudas recibidas</h3>

          ${spark(ds)}

          ${ds.length
            ? `
              <div class="feed">

                ${ds
                  .slice()
                  .reverse()
                  .slice(0, 90)
                  .map(d => `
                    <div class="doubt ${
                      d.hidden
                        ? "hidden-doubt"
                        : ""
                    }">

                      <span class="t">
                        ${fmt(d.created_at)}
                        ${d.hidden
                          ? "· OCULTA"
                          : ""}
                      </span>

                      <div class="doubt-text">
                        ${esc(d.text)}
                      </div>

                      ${!S.demo
                        ? `
                          <div class="controls">

                            <button
                              class="btn sm"
                              data-act="moderate"
                              data-id="${esc(d.id)}"
                              data-hidden="${
                                d.hidden
                                  ? "false"
                                  : "true"
                              }">

                              ${d.hidden
                                ? "Restaurar"
                                : "Ocultar"}

                            </button>
                          </div>
                        `
                        : ""}

                    </div>
                  `)
                  .join("")}

              </div>
            `
            : `
              <div class="empty">
                Todavía no hay dudas.
              </div>
            `}

        </div>
      </aside>
    </div>
  `;
}

// ==========================================
// EVALUACIÓN FORMATIVA
// ==========================================

function pulseBlock(c, answers) {
  const percent = answers.total
    ? Math.round(
        100 * answers.yes / answers.total
      )
    : 0;

  return `
    ${c.pulse_version > 0
      ? `
        <p>
          <b>
            ${esc(c.pulse_question)}
          </b>
        </p>

        <div class="pulse-results">

          <div>
            <div class="pulse-number">
              ${answers.yes}
            </div>
            Sí, comprendí
          </div>

          <div>
            <div class="pulse-number">
              ${answers.no}
            </div>
            Todavía tengo dudas
          </div>

        </div>

        <div class="pulse-meter">
          <span style="width:${percent}%"></span>
        </div>

        ${c.pulse_open
          ? `
            <button
              class="btn sm"
              data-act="closePulse">
              Cerrar comprobación
            </button>
          `
          : ""}
      `
      : `
        <p class="muted small">
          Pregunta si el contenido quedó claro.
        </p>
      `}

    ${active()
      ? `
        <form
          class="stack"
          data-form="pulse">

          <label class="f">
            Pregunta de comprobación

            <input
              id="pulse-question"
              type="text"
              minlength="8"
              maxlength="180"
              required
              value="¿Quedó claro el tema que acabamos de repasar?"
            >
          </label>

          <button
            class="btn primary"
            type="submit">
            Lanzar comprobación
          </button>

        </form>
      `
      : ""}
  `;
}

// ==========================================
// RESULTADOS PEDAGÓGICOS
// ==========================================

function currentAnalysis(doubts) {
  if (!doubts.length) return null;

  if (S.demo) {
    return demoAnalysis(doubts);
  }

  const fingerprint = doubts
    .map(d => d.id)
    .join("|");

  if (
    S.ai &&
    S.ai.fingerprint === fingerprint &&
    S.ai.topics?.length
  ) {
    return {
      ...S.ai,
      source: "ia"
    };
  }

  return localAnalysis(doubts);
}

function analysisBlock(
  analysis,
  live,
  source
) {
  if (!analysis) {
    return `
      <div class="card stack">

        <h2>El análisis aparecerá aquí</h2>

        <p class="muted">
          Cuando lleguen preguntas podrás
          solicitar su clasificación con Gemini.
        </p>

      </div>
    `;
  }

  const topics = analysis.topics || [];

  const main =
    topics.find(t => t.id === analysis.main) ||
    topics[0];

  const total =
    analysis.processed ||
    analysis.count ||
    live.length;

  const max = Math.max(
    1,
    ...topics.map(t => t.ids.length)
  );

  const byId = new Map(
    live.map(d => [d.id, d])
  );

  const statusLine =
    source === "ia"
      ? analysis.syllabusUsed
        ? "Clasificación según programa PDF · Gemini"
        : "Análisis pedagógico con Gemini"
      : source === "demo"
        ? "Análisis ilustrativo"
        : "Agrupación textual automática";

  return `
    <div class="statusline">

      <span class="small muted">
        ${esc(statusLine)}
        · ${total} dudas
      </span>

      <span class="spacer"></span>

      ${!S.demo
        ? `
          <button
            class="btn sm"
            data-act="analyzeAI"
            ${S.aiBusy ? "disabled" : ""}>

            ${S.aiBusy
              ? "Analizando…"
              : "Analizar con IA"}

          </button>
        `
        : ""}
    </div>

    ${main
      ? `
        <div class="hl k-${esc(main.kind)}">

          <span class="ic">!</span>

          <div>
            <span class="eyebrow">
              Prioridad para el docente
            </span>

            <h2>${esc(main.label)}</h2>

            <p>
              <b>
                ${main.ids.length}
                de ${total}
              </b>
              dudas analizadas.
            </p>

            <p>${esc(main.gap)}</p>

            ${main.tip
              ? `
                <p class="small">
                  <b>Intervención sugerida:</b>
                  ${esc(main.tip)}
                </p>
              `
              : ""}
          </div>
        </div>
      `
      : ""}

    <div class="card stack">

      <h3>Temas identificados</h3>

      <div class="chart">

        ${topics.map(t => {
          const open =
            S.openTopic === t.id;

          return `
            <button
              class="crow k-${esc(t.kind)} ${
                open ? "open" : ""
              }"
              data-act="topic"
              data-id="${esc(t.id)}">

              <span class="lab">
                <b>${esc(t.label)}</b>
                <span class="n">
                  ${t.ids.length}
                </span>
              </span>

              <span class="track">
                <span class="fill"
                  style="width:${
                    Math.round(
                      100 *
                      t.ids.length /
                      max
                    )
                  }%">
                </span>
              </span>

              ${open
                ? `
                  <span class="detail">

                    <span class="small">
                      ${esc(t.gap)}
                    </span>

                    ${t.ids
                      .slice(0, 8)
                      .map(id => byId.get(id))
                      .filter(Boolean)
                      .map(d => `
                        <span class="q">
                          ${esc(d.text)}
                        </span>
                      `)
                      .join("")}

                  </span>
                `
                : ""}
            </button>
          `;
        }).join("")}

      </div>
    </div>

    ${analysis.summary
      ? `
        <div class="card">

          <span class="eyebrow">
            Síntesis pedagógica
          </span>

          <p>
            ${esc(analysis.summary)}
          </p>
        </div>
      `
      : ""}
  `;
}

// ==========================================
// PROYECCIÓN Y GRÁFICO
// ==========================================

function viewProjector() {
  const code = S.cls.code;
  const url = classUrl(code);

  return `
    <div class="proj"
      role="dialog"
      aria-modal="true">

      <p>Escanea el QR o escribe el código</p>

      <div class="code">
        ${esc(code)}
      </div>

      <div id="qrbox" class="qr"></div>

      <p class="url">
        ${esc(url)}
      </p>

      <button
        class="btn"
        data-act="copyLink">
        Copiar enlace
      </button>

      <button
        class="btn"
        data-act="closeProj">
        Cerrar proyección
      </button>
    </div>
  `;
}

function spark(doubts) {
  if (!doubts.length) {
    return `
      <svg class="spark"
        viewBox="0 0 240 46">
        <line
          x1="0"
          y1="45"
          x2="240"
          y2="45">
        </line>
      </svg>
    `;
  }

  const bins = new Array(24).fill(0);

  const times = doubts
    .map(d => +new Date(d.created_at))
    .filter(Number.isFinite);

  if (!times.length) return "";

  const first = Math.min(...times);

  const last = Math.max(
    Date.now(),
    first + 60000
  );

  const span = (last - first) / 24;

  times.forEach(t => {
    const index = Math.min(
      23,
      Math.max(
        0,
        Math.floor((t - first) / span)
      )
    );

    bins[index]++;
  });

  const max = Math.max(1, ...bins);

  return `
    <svg
      class="spark"
      viewBox="0 0 240 46"
      preserveAspectRatio="none">

      ${bins.map((value, i) =>
        value
          ? `
            <rect
              x="${i * 10 + 1}"
              y="${46 - value / max * 42}"
              width="8"
              height="${value / max * 42}"
              rx="1.5">
            </rect>
          `
          : ""
      ).join("")}

    </svg>
  `;
}

// ==========================================
// CLASIFICACIÓN LOCAL DE RESPALDO
// ==========================================

function localAnalysis(doubts) {
  const terms = text =>
    [...new Set(
      normal(text)
        .split(/\s+/)
        .filter(
          w => w.length > 2 && !STOP.has(w)
        )
    )];

  const OFF =
    /\b(prueba|control|certamen|examen|tarea|nota|diapositiva|ppt|horario|asistencia)\b/;

  const items = doubts.map(d => ({
    ...d,
    terms: terms(d.text),
    administrative: OFF.test(
      normal(d.text)
    )
  }));

  const groups = new Map();

  const academic = items.filter(
    d => !d.administrative
  );

  for (const item of academic) {
    const key =
      item.terms.slice(0, 2).join(" ") ||
      "otras";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  }

  const topics = [];

  let index = 0;

  for (const [key, group] of groups) {
    topics.push({
      id: "local-" + index++,
      label:
        key === "otras"
          ? "Otras dudas"
          : key.replace(
              /^./,
              c => c.toUpperCase()
            ),
      kind: "duda",
      gap: "Dudas que comparten términos.",
      tip: "Revisar ejemplos y explicar nuevamente.",
      ids: group.map(d => d.id)
    });
  }

  const administrative = items.filter(
    d => d.administrative
  );

  if (administrative.length) {
    topics.push({
      id: "admin",
      label: "Preguntas administrativas",
      kind: "otro",
      gap: "Consultas sobre la organización.",
      tip: "",
      ids: administrative.map(d => d.id)
    });
  }

  topics.sort(
    (a, b) => b.ids.length - a.ids.length
  );

  return {
    source: "local",
    count: doubts.length,
    processed: doubts.length,
    topics,
    main: topics[0]?.id,
    summary:
      "Agrupación textual preliminar. Usa Analizar con IA para obtener una clasificación semántica."
  };
}

function demoAnalysis(doubts) {
  const topics = Object.entries(DDEFS)
    .map(([key, definition]) => ({
      id: "demo" + key,
      ...definition,
      ids: doubts
        .filter(d => d.tag === key)
        .map(d => d.id)
    }))
    .filter(t => t.ids.length);

  topics.sort(
    (a, b) => b.ids.length - a.ids.length
  );

  return {
    source: "demo",
    count: doubts.length,
    processed: doubts.length,
    topics,
    main: topics[0]?.id,
    summary:
      "Escenario ilustrativo de dificultades algebraicas."
  };
}

// ==========================================
// SESIONES Y REALTIME
// ==========================================

function clearRealtime() {
  S.syncError = "";
  S.lastSyncAt = null;

  if (S.channel) {
    try {
      S.channel.client.removeChannel(
        S.channel.channel
      );
    } catch {}

    S.channel = null;
  }

  if (S.poll) {
    clearInterval(S.poll);
    S.poll = null;
  }

  if (S.queued) {
    clearTimeout(S.queued);
    S.queued = null;
  }

  S.live = false;
  S.refreshEpoch++;
  S.refreshBusy = false;

  status();
}

function home() {
  clearRealtime();

  S.projector = false;
  S.confirm = null;
  S.cls = null;
  S.student = null;
  S.demo = false;
  S.doubts = [];
  S.ai = null;
  S.program = null;
  S.view = "home";

  if (
    location.hash &&
    /^[A-HJ-NP-Z2-9]{6}$/.test(
      location.hash.slice(1).toUpperCase()
    )
  ) {
    history.replaceState(
      null,
      "",
      location.pathname + location.search
    );
  }

  render();
}

function backClasses() {
  clearRealtime();

  S.projector = false;
  S.cls = null;
  S.demo = false;
  S.doubts = [];
  S.ai = null;
  S.program = null;

  S.view = S.teacher
    ? "teacher"
    : "home";

  render();

  if (S.view === "teacher") {
    loadClasses();
  }
}

function demo() {
  clearRealtime();

  S.demo = true;
  S.view = "dash";
  S.doubts = [];
  S.doubtTotal = 0;
  S.participants = 0;
  S.ai = null;

  S.cls = {
    id: "demo",
    code: "DEMO00",
    title: "MA1101 Álgebra · Ejemplo",
    topic: "Ecuaciones",
    status: "open",
    pulse_version: 0
  };

  S.demoBusy = false;
  S.openTopic = null;

  render();
}

async function simulate() {
  if (!S.demo || S.demoBusy) return;

  S.demoBusy = true;
  S.doubts = [];
  S.doubtTotal = 0;

  render();

  for (let i = 0; i < DEMO.length; i++) {
    if (!S.demo || S.view !== "dash") {
      break;
    }

    const [text, tag] = DEMO[i];

    S.doubts.push({
      id: "demo-" + i,
      text,
      tag,
      hidden: false,
      created_at: new Date().toISOString()
    });

    S.doubtTotal = S.doubts.length;

    render();
    await sleep(350);
  }

  S.demoBusy = false;
  render();
}

// ==========================================
// INICIALIZAR SUPABASE
// ==========================================

async function init() {
  render();

  if (!configured) return;

  try {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.81.1/+esm"
    );

    const options = key => ({
      auth: {
        storageKey: key,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl:
          key === "ds-teacher-v2"
      }
    });

    S.tc = createClient(
      CFG.supabaseUrl,
      CFG.supabasePublishableKey,
      options("ds-teacher-v2")
    );

    S.sc = createClient(
      CFG.supabaseUrl,
      CFG.supabasePublishableKey,
      options("ds-student-v2")
    );

    S.tc.auth.onAuthStateChange(
      (event, session) => {
        const user =
          session?.user &&
          !session.user.is_anonymous
            ? session.user
            : null;

        const changed =
          (S.teacher?.id || null) !==
          (user?.id || null);

        S.teacher = user;

        if (changed && user) {
          setTimeout(() => {
            if (
              S.view === "home" ||
              S.view === "teacher"
            ) {
              S.view = "teacher";
              loadClasses();
            }
          }, 40);
        } else if (
          changed &&
          !user &&
          ["teacher", "dash"].includes(S.view) &&
          !S.demo
        ) {
          setTimeout(home, 40);
        }
      }
    );

    const { data, error } =
      await S.tc.auth.getSession();

    if (error) throw error;

    S.teacher =
      data.session?.user &&
      !data.session.user.is_anonymous
        ? data.session.user
        : null;

    S.ready = true;
    S.connectError = "";

    const hash =
      location.hash.slice(1).toUpperCase();

    if (/^[A-HJ-NP-Z2-9]{6}$/.test(hash)) {
      render();
      await joinClass(hash);
    } else if (S.teacher) {
      S.view = "teacher";
      await loadClasses();
    } else {
      render();
    }

  } catch (error) {
    S.ready = false;
    S.connectError = errMessage(error);
    render();
  }
}

// ==========================================
// CLASES DOCENTES
// ==========================================

async function loadClasses() {
  if (!S.tc || !S.teacher) return;

  const { data, error } = await S.tc
    .from("ds_classes")
    .select(
      "id,code,teacher_id,title,topic,status,pulse_question,pulse_version,pulse_open,created_at"
    )
    .eq("teacher_id", S.teacher.id)
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  if (error) {
    toast(
      "No pude cargar las clases: " +
      errMessage(error),
      true
    );
    return;
  }

  S.classes = data || [];

  if (S.view === "teacher") {
    render();
  }
}

async function teacher() {
  if (!configured) return;

  clearRealtime();
  S.view = "teacher";
  render();

  if (S.teacher) {
    await loadClasses();
  }
}

async function sendLogin(email) {
  if (!S.tc) return;

  const token = captchaToken();

  if (captchaEnabled() && !token) {
    return toast(
      "Completa la verificación anti-bots.",
      true
    );
  }

  S.actionBusy = true;
  render();

  const options = {
    emailRedirectTo:
      location.origin + location.pathname,
    shouldCreateUser: true
  };

  if (token) {
    options.captchaToken = token;
  }

  const { error } =
    await S.tc.auth.signInWithOtp({
      email: clean(email, 160),
      options
    });

  S.actionBusy = false;

  if (error) {
    toast(errMessage(error), true);
  } else {
    S.otpSent = true;
    toast("Revisa tu correo electrónico.");
  }

  render();
}

async function logout() {
  if (!S.tc) return;

  clearRealtime();

  const { error } =
    await S.tc.auth.signOut();

  if (error) {
    toast(errMessage(error), true);
  }

  S.teacher = null;
  S.classes = [];

  home();
}

async function createClass(title, topic) {
  if (!S.tc || !S.teacher) return;

  S.actionBusy = true;
  render();

  const { data, error } = await S.tc.rpc(
    "ds_create_class",
    {
      p_title: title,
      p_topic: topic
    }
  );

  S.actionBusy = false;

  if (error) {
    toast(errMessage(error), true);
    render();
    return;
  }

  await loadClasses();
  await openClass(data);

  toast("Clase creada. Código " + data.code);
}

async function openClass(c) {
  if (!c) return;

  clearRealtime();

  S.demo = false;
  S.view = "dash";
  S.cls = { ...c };

  S.doubts = [];
  S.doubtTotal = 0;
  S.participants = 0;

  S.pulse = {
    yes: 0,
    no: 0,
    total: 0
  };

  S.ai = read("ds_ai_" + c.id, null);
  S.openTopic = null;
  S.projector = false;

  S.program = null;
  S.programBusy = false;
  S.programError = "";
  S.programSelectedFile = null;

  S.loading = true;
  render();

  await Promise.all([
    refreshDash(true),
    loadProgram()
  ]);

  watchTeacher();
}

// ==========================================
// CARGAR PROGRAMA DESDE SUPABASE
// ==========================================

async function loadProgram() {
  if (
    !S.tc ||
    !S.cls ||
    S.demo
  ) return;

  const classId = S.cls.id;

  const { data, error } = await S.tc
    .from("ds_course_documents")
    .select(
      "class_id,file_name,storage_path,file_size_bytes,status,taxonomy,updated_at"
    )
    .eq("class_id", classId)
    .maybeSingle();

  if (S.cls?.id !== classId) return;

  if (error) {
    S.programError =
      "No se pudo cargar el programa del curso.";
  } else {
    S.program = data || null;
    S.programError = "";

    if (
      S.ai &&
      (
        (data && !S.ai.syllabusUsed) ||
        (
          S.ai.syllabusUsed &&
          S.ai.syllabusVersion !==
            data?.updated_at
        )
      )
    ) {
      S.ai = null;
      delStore("ds_ai_" + classId);
    }
  }

  if (S.view === "dash") {
    render();
  }
}

// ==========================================
// SUBIR PDF Y ANALIZAR CON GEMINI
// ==========================================

async function uploadProgram(file) {
  if (
    !file ||
    !S.cls ||
    !S.teacher ||
    S.programBusy
  ) return;

  if (
    !/\.pdf$/i.test(file.name) ||
    (
      file.type &&
      file.type !== "application/pdf"
    )
  ) {
    toast(
      "Selecciona un archivo PDF válido.",
      true
    );
    return;
  }

  if (
    file.size < 10 ||
    file.size > 8 * 1024 * 1024
  ) {
    toast(
      "El PDF debe pesar menos de 8 MB.",
      true
    );
    return;
  }

  const classId = S.cls.id;

  const oldPath =
    S.program?.storage_path || null;

  const path =
    `${classId}/${crypto.randomUUID()}.pdf`;

  S.programBusy = true;
  render();

  let uploaded = false;
  let processed = false;

  try {
    // Subir a Storage privado
    const { error: uploadError } =
      await S.tc.storage
        .from("ds-programas")
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false
        });

    if (uploadError) {
      throw uploadError;
    }

    uploaded = true;

    // Invocar Edge Function
    const { data, error } =
      await S.tc.functions.invoke(
        "procesar-programa",
        {
          body: {
            classId,
            path,
            fileName: file.name.slice(0, 200)
          }
        }
      );

    if (error) {
      let details = "";

      try {
        details =
          (await error.context?.json?.())
            ?.error || "";
      } catch {}

      throw new Error(
        details ||
        "No fue posible analizar el PDF."
      );
    }

    if (
      !data?.ok ||
      !data?.taxonomy?.units?.length
    ) {
      throw new Error(
        data?.error ||
        "Gemini no pudo extraer el temario."
      );
    }

    processed = true;

    // Invalidar análisis anterior
    S.ai = null;
    delStore("ds_ai_" + classId);

    S.programSelectedFile = null;

    await loadProgram();

    toast(
      "Programa analizado correctamente. Ahora puedes clasificar las dudas con IA."
    );

    // Eliminar documento antiguo
    if (oldPath && oldPath !== path) {
      try {
        const { error: removeError } =
          await S.tc.storage
            .from("ds-programas")
            .remove([oldPath]);

        if (removeError) {
          console.warn(
            "No se pudo eliminar el PDF anterior."
          );
        }
      } catch {}
    }

  } catch (error) {
    // Limpiar únicamente el archivo nuevo
    // cuando el análisis no terminó.
    if (uploaded && !processed) {
      try {
        await S.tc.storage
          .from("ds-programas")
          .remove([path]);
      } catch {}
    }

    toast(
      "Error PDF: " + errMessage(error),
      true
    );

  } finally {
    S.programBusy = false;
    render();
  }
}

// ==========================================
// ACTUALIZAR PANEL
// ==========================================

async function refreshDash(force = false) {
  if (
    !S.tc ||
    !S.cls ||
    S.demo ||
    S.view !== "dash"
  ) return;

  if (S.refreshBusy && !force) {
    return;
  }

  const epoch = S.refreshEpoch;
  const id = S.cls.id;

  S.refreshBusy = true;

  try {
    const results = await Promise.all([
      S.tc
        .from("ds_doubts")
        .select(
          "id,class_id,text,hidden,created_at",
          { count: "exact" }
        )
        .eq("class_id", id)
        .order("created_at", {
          ascending: false
        })
        .limit(1000),

      S.tc.rpc(
        "ds_participant_count",
        { p_class_id: id }
      ),

      S.tc.rpc(
        "ds_pulse_results",
        { p_class_id: id }
      ),

      S.tc
        .from("ds_classes")
        .select(
          "id,code,title,topic,status,pulse_question,pulse_version,pulse_open,created_at"
        )
        .eq("id", id)
        .single()
    ]);

    if (
      epoch !== S.refreshEpoch ||
      S.cls?.id !== id ||
      S.view !== "dash"
    ) return;

    const [d, p, a, c] = results;

    if (
      d.error ||
      p.error ||
      a.error ||
      c.error
    ) {
      throw (
        d.error ||
        p.error ||
        a.error ||
        c.error
      );
    }

    S.doubts = (d.data || []).reverse();
    S.doubtTotal = d.count || 0;

    S.participants =
      Number(p.data) || 0;

    S.pulse = {
      yes: Number(
        a.data?.[0]?.yes_count || 0
      ),
      no: Number(
        a.data?.[0]?.no_count || 0
      ),
      total: Number(
        a.data?.[0]?.total_count || 0
      )
    };

    S.cls = {
      ...S.cls,
      ...c.data
    };

    S.loading = false;
    S.lastSyncAt =
      new Date().toISOString();

    S.syncError = "";

    render();

  } catch (error) {
    S.loading = false;
    S.syncError = errMessage(error);

    if (S.view === "dash") {
      render();
    }

    if (force) {
      toast(
        "Error al actualizar tablero: " +
        S.syncError,
        true
      );
    }

  } finally {
    if (epoch === S.refreshEpoch) {
      S.refreshBusy = false;
    }
  }
}

// ==========================================
// REALTIME Y ACTUALIZACIONES
// ==========================================

function scheduleRefresh() {
  if (S.queued) {
    clearTimeout(S.queued);
  }

  S.queued = setTimeout(() => {
    S.queued = null;

    if (S.view === "dash") {
      refreshDash();
    } else {
      refreshStudent();
    }
  }, 250);
}

function watchTeacher() {
  if (!S.tc || !S.cls || S.demo) return;

  const id = S.cls.id;
  const client = S.tc;

  const channel = client
    .channel("ds-profesor-" + id)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ds_doubts",
        filter: "class_id=eq." + id
      },
      scheduleRefresh
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "ds_classes",
        filter: "id=eq." + id
      },
      scheduleRefresh
    )
    .subscribe(value => {
      S.live = value === "SUBSCRIBED";
      status();
    });

  S.channel = {
    client,
    channel
  };

  S.poll = setInterval(() => {
    if (
      S.view === "dash" &&
      !S.demo
    ) {
      refreshDash();
    }
  }, 10000);
}

// ==========================================
// INGRESO ESTUDIANTE
// ==========================================

async function joinClass(code) {
  if (!S.sc || S.actionBusy) return;

  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
    return toast(
      "El código debe tener seis caracteres válidos.",
      true
    );
  }

  try {
    const {
      data: auth,
      error: authError
    } = await S.sc.auth.getSession();

    if (authError) throw authError;

    const token = auth.session
      ? null
      : captchaToken();

    if (
      !auth.session &&
      captchaEnabled() &&
      !token
    ) {
      S.view = "home";
      render();

      toast(
        "Completa la verificación anti-bots.",
        true
      );

      return;
    }

    S.actionBusy = true;
    render();

    if (!auth.session) {
      const { error } =
        await S.sc.auth.signInAnonymously(
          token
            ? {
                options: {
                  captchaToken: token
                }
              }
            : undefined
        );

      if (error) throw error;
    }

    const { data, error } =
      await S.sc.rpc(
        "ds_join_class",
        { p_code: code }
      );

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "Código no encontrado o demasiados intentos."
      );
    }

    clearRealtime();

    S.student = data[0];
    S.studentSent = false;
    S.view = "student";
    S.actionBusy = false;

    if (location.hash !== "#" + code) {
      history.replaceState(
        null,
        "",
        location.pathname +
          location.search +
          "#" +
          code
      );
    }

    render();
    watchStudent();

  } catch (error) {
    S.actionBusy = false;
    toast(errMessage(error), true);
    render();
  }
}

function watchStudent() {
  if (!S.student || !S.sc) return;

  const id = S.student.id;
  const client = S.sc;

  const channel = client
    .channel("ds-estudiante-" + id)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "ds_classes",
        filter: "id=eq." + id
      },
      scheduleRefresh
    )
    .subscribe(value => {
      S.live = value === "SUBSCRIBED";
      status();
    });

  S.channel = {
    client,
    channel
  };

  S.poll = setInterval(
    refreshStudent,
    12000
  );
}

async function refreshStudent() {
  if (
    !S.sc ||
    !S.student ||
    S.view !== "student"
  ) return;

  const id = S.student.id;

  const { data, error } = await S.sc
    .from("ds_classes")
    .select(
      "id,code,title,topic,status,pulse_question,pulse_version,pulse_open,created_at"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      toast(
        "Esta clase ya no existe.",
        true
      );

      home();
    }
    return;
  }

  if (S.student?.id === id) {
    S.student = {
      ...S.student,
      ...data
    };

    render();
  }
}

// ==========================================
// MODERACIÓN Y ENVÍO DE DUDAS
// ==========================================

async function submitDoubt(text) {
  if (!S.student || S.actionBusy) return;

  const message = clean(text, 400);

  if (message.length < 5) {
    return toast(
      "Escribe al menos 5 caracteres.",
      true
    );
  }

  S.actionBusy = true;
  render();

  try {
    // Moderación previa con Gemini
    const {
      data,
      error
    } = await S.sc.functions.invoke(
      "moderar-duda",
      {
        body: {
          text: message
        }
      }
    );

    if (error) {
      let details = "";

      try {
        details =
          (await error.context?.json?.())
            ?.error || "";
      } catch {}

      throw new Error(
        details ||
        "No se pudo revisar la pregunta."
      );
    }

    if (data?.decision !== "approve") {
      toast(
        data?.message ||
        "Reformula tu pregunta.",
        true
      );
      return;
    }

    // Guardar pregunta aprobada
    const {
      error: saveError
    } = await S.sc.rpc(
      "ds_submit_doubt",
      {
        p_class_id: S.student.id,
        p_text: message
      }
    );

    if (saveError) {
      throw saveError;
    }

    S.studentSent = true;
    S.studentSentCount++;

  } catch (error) {
    toast(errMessage(error), true);

  } finally {
    S.actionBusy = false;
    render();
  }
}

// ==========================================
// COMPROBACIÓN DE COMPRENSIÓN
// ==========================================

async function answerPulse(value) {
  if (!S.student || S.actionBusy) return;

  S.actionBusy = true;
  render();

  const { error } = await S.sc.rpc(
    "ds_answer_pulse",
    {
      p_class_id: S.student.id,
      p_version: S.student.pulse_version,
      p_understood: value
    }
  );

  S.actionBusy = false;

  if (error) {
    toast(errMessage(error), true);
  } else {
    store(
      `ds_pulse_${S.student.id}_${S.student.pulse_version}`,
      value
    );

    toast("Respuesta registrada.");
  }

  render();
}

// ==========================================
// ACCIONES DEL PROFESOR
// ==========================================

async function runAction(fn, success) {
  if (S.actionBusy) return;

  S.actionBusy = true;
  render();

  try {
    await fn();

    if (success) {
      toast(success);
    }
  } catch (error) {
    toast(errMessage(error), true);
  } finally {
    S.actionBusy = false;
    render();
  }
}

async function callTeacher(name, params) {
  const { data, error } =
    await S.tc.rpc(name, params);

  if (error) throw error;

  return data;
}

function confirmAction(
  title,
  message,
  ok,
  run,
  danger = false
) {
  S.confirm = {
    title,
    message,
    ok,
    run,
    danger
  };

  render();
}

async function toggleClass() {
  if (!S.cls || S.demo) return;

  const close = active();

  confirmAction(
    close
      ? "Terminar la clase"
      : "Reabrir la clase",

    close
      ? "La clase dejará de recibir dudas."
      : "La clase volverá a recibir dudas.",

    close
      ? "Terminar"
      : "Reabrir",

    async () => {
      await runAction(
        async () => {
          await callTeacher(
            "ds_set_class_status",
            {
              p_class_id: S.cls.id,
              p_status: close
                ? "closed"
                : "open"
            }
          );

          await refreshDash(true);
        },

        close
          ? "Clase terminada."
          : "Clase reabierta."
      );
    },

    close
  );
}

async function moderate(id, hidden) {
  await runAction(
    async () => {
      await callTeacher(
        "ds_set_doubt_hidden",
        {
          p_doubt_id: id,
          p_hidden: hidden
        }
      );

      await refreshDash(true);
    },

    hidden
      ? "Duda oculta."
      : "Duda restaurada."
  );
}

async function startPulse(question) {
  await runAction(
    async () => {
      await callTeacher(
        "ds_start_pulse",
        {
          p_class_id: S.cls.id,
          p_question: question
        }
      );

      await refreshDash(true);
    },

    "Pregunta de comprobación enviada."
  );
}

async function closePulse() {
  await runAction(
    async () => {
      await callTeacher(
        "ds_close_pulse",
        {
          p_class_id: S.cls.id
        }
      );

      await refreshDash(true);
    },

    "Comprobación cerrada."
  );
}

function deleteClass(id) {
  const c = S.classes.find(
    x => x.id === id
  );

  if (!c) return;

  confirmAction(
    "Eliminar clase",
    `Se eliminará definitivamente «${c.title}» y sus datos.`,
    "Eliminar definitivamente",

    async () => {
      await runAction(
        async () => {
          await callTeacher(
            "ds_delete_class",
            {
              p_class_id: id
            }
          );

          await loadClasses();
        },

        "Clase eliminada."
      );
    },

    true
  );
}

// ==========================================
// ANÁLISIS PEDAGÓGICO CON GEMINI
// ==========================================

async function analyzeAI() {
  if (
    S.demo ||
    !S.cls ||
    S.aiBusy ||
    !visibleDoubts().length
  ) return;

  S.aiBusy = true;
  render();

  try {
    const {
      data,
      error
    } = await S.tc.functions.invoke(
      "analizar-dudas",
      {
        body: {
          classId: S.cls.id
        }
      }
    );

    if (error) {
      let details = "";

      try {
        details =
          (await error.context?.json?.())
            ?.error || "";
      } catch {}

      throw new Error(
        details ||
        "No se pudo analizar con Gemini."
      );
    }

    if (!data?.topics?.length) {
      throw new Error(
        data?.error ||
        "Gemini no entregó temas válidos."
      );
    }

    await refreshDash(true);

    S.ai = {
      ...data,
      fingerprint: visibleDoubts()
        .map(d => d.id)
        .join("|"),
      source: "ia"
    };

    store(
      "ds_ai_" + S.cls.id,
      S.ai
    );

    toast(
      "El análisis pedagógico está listo."
    );

  } catch (error) {
    toast(
      "IA: " + errMessage(error),
      true
    );

  } finally {
    S.aiBusy = false;
    render();
  }
}

// ==========================================
// EXPORTACIÓN CSV
// ==========================================

function csvSafe(value) {
  let text = String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, " ")
    .replace(/[\r\n]/g, " ");

  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return '"' +
    text.replace(/"/g, '""') +
    '"';
}

function download(
  filename,
  data,
  type
) {
  const a = document.createElement("a");

  const url = URL.createObjectURL(
    new Blob([data], { type })
  );

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    10000
  );
}

function csv() {
  if (!S.cls) return;

  const rows = [
    [
      "fecha",
      "hora",
      "clase",
      "duda",
      "estado"
    ],

    ...S.doubts.map(d => {
      const date =
        new Date(d.created_at);

      return [
        date.toLocaleDateString("es-CL"),
        fmt(d.created_at),
        S.cls.title,
        d.text,
        d.hidden ? "oculta" : "visible"
      ];
    })
  ];

  const content =
    "\ufeff" +
    rows
      .map(row =>
        row.map(csvSafe).join(";")
      )
      .join("\r\n");

  download(
    `dudas-${slug(S.cls.title)}.csv`,
    content,
    "text/csv;charset=utf-8"
  );
}

// ==========================================
// INFORME DEL DOCENTE
// ==========================================

function report() {
  if (!S.cls) return;

  const doubts = visibleDoubts();
  const analysis = currentAnalysis(doubts);
  const pulse = S.pulse;

  const html = `
    <!doctype html>
    <html lang="es">

    <head>
      <meta charset="utf-8">

      <title>
        Informe · ${esc(S.cls.title)}
      </title>

      <style>
        body {
          font: 15px/1.6 system-ui, Arial;
          color: #132429;
          max-width: 830px;
          margin: 45px auto;
          padding: 0 25px;
        }

        h1 {
          font-size: 30px;
        }

        h2 {
          color: #2c5b66;
          margin-top: 35px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border-bottom: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
      </style>
    </head>

    <body>

      <h1>${esc(S.cls.title)}</h1>

      <p>${esc(S.cls.topic || "")}</p>

      <p>
        Código: ${esc(S.cls.code)}
      </p>

      <h2>Resumen</h2>

      <p>
        ${doubts.length} dudas visibles.
      </p>

      <h2>Análisis pedagógico</h2>

      <p>
        ${esc(
          analysis?.summary ||
          "Sin análisis."
        )}
      </p>

      <table>
        <thead>
          <tr>
            <th>Tema</th>
            <th>Dudas</th>
            <th>Intervención</th>
          </tr>
        </thead>

        <tbody>
          ${(analysis?.topics || [])
            .map(t => `
              <tr>
                <td>${esc(t.label)}</td>
                <td>${t.ids.length}</td>
                <td>${esc(t.tip)}</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>

      <h2>Comprobación posterior</h2>

      <p>
        Comprendió: ${pulse.yes}.
        Todavía tiene dudas: ${pulse.no}.
      </p>

      <h2>Preguntas recibidas</h2>

      <ol>
        ${doubts.map(d => `
          <li>${esc(d.text)}</li>
        `).join("")}
      </ol>

      <p>
        <button onclick="window.print()">
          Imprimir / Guardar PDF
        </button>
      </p>

    </body>
    </html>
  `;

  download(
    `informe-${slug(S.cls.title)}.html`,
    html,
    "text/html;charset=utf-8"
  );

  toast(
    "Informe descargado. Ábrelo para guardar como PDF."
  );
}

// ==========================================
// ACCIONES Y EVENTOS
// ==========================================

function copyLink() {
  const value = classUrl(S.cls.code);

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast("Enlace copiado."))
      .catch(() =>
        window.prompt(
          "Copia el enlace:",
          value
        )
      );
  } else {
    window.prompt(
      "Copia el enlace:",
      value
    );
  }
}

const ACTIONS = {
  home,
  teacher,
  demo,
  simulate,
  logout,
  backClasses,

  refreshClasses: loadClasses,

  openClass: element =>
    openClass(
      S.classes.find(
        c => c.id === element.dataset.id
      )
    ),

  deleteClass: element =>
    deleteClass(element.dataset.id),

  refreshDash: () =>
    refreshDash(true),

  topic: element => {
    S.openTopic =
      S.openTopic === element.dataset.id
        ? null
        : element.dataset.id;

    render();
  },

  another: () => {
    S.studentSent = false;
    render();
    $("#d-text")?.focus();
  },

  pulseYes: () =>
    answerPulse(true),

  pulseNo: () =>
    answerPulse(false),

  toggleClass,

  proj: () => {
    S.projector = true;
    render();
  },

  closeProj: () => {
    S.projector = false;
    render();
  },

  copyLink,
  closePulse,

  moderate: element =>
    moderate(
      element.dataset.id,
      element.dataset.hidden === "true"
    ),

  analyzeAI,
  csv,
  report,

  cancelConfirm: () => {
    S.confirm = null;
    render();
  },

  acceptConfirm: () => {
    const confirmation = S.confirm;

    S.confirm = null;
    render();

    if (confirmation) {
      confirmation.run();
    }
  }
};

document.addEventListener(
  "click",
  event => {
    const element =
      event.target.closest("[data-act]");

    if (!element) return;

    const fn =
      ACTIONS[element.dataset.act];

    if (!fn) return;

    event.preventDefault();

    Promise.resolve(fn(element))
      .catch(error =>
        toast(errMessage(error), true)
      );
  }
);

// Guardar archivo PDF seleccionado
document.addEventListener(
  "change",
  event => {
    if (
      event.target.id === "ds-program-pdf"
    ) {
      S.programSelectedFile =
        event.target.files?.[0] || null;
    }
  }
);

document.addEventListener(
  "input",
  event => {
    if (event.target.id === "join-code") {
      event.target.value =
        event.target.value
          .toUpperCase()
          .replace(/[^A-HJ-NP-Z2-9]/g, "");
    }
  }
);

document.addEventListener(
  "submit",
  event => {
    const form =
      event.target.closest(
        "form[data-form]"
      );

    if (!form) return;

    event.preventDefault();

    const val = id =>
      document.getElementById(id)
        ?.value?.trim() || "";

    const submit = {
      join: () =>
        joinClass(
          val("join-code").toUpperCase()
        ),

      login: () =>
        sendLogin(val("email")),

      create: () =>
        createClass(
          val("c-title"),
          val("c-topic")
        ),

      doubt: () =>
        submitDoubt(val("d-text")),

      pulse: () =>
        startPulse(
          val("pulse-question")
        ),

      program: () =>
        uploadProgram(
          document
            .getElementById(
              "ds-program-pdf"
            )
            ?.files?.[0] ||
          S.programSelectedFile
        )
    }[form.dataset.form];

    if (submit) {
      Promise.resolve(submit())
        .catch(error =>
          toast(errMessage(error), true)
        );
    }
  }
);

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      if (S.confirm) {
        S.confirm = null;
      } else if (S.projector) {
        S.projector = false;
      } else {
        return;
      }

      render();
    }
  }
);

window.addEventListener(
  "hashchange",
  () => {
    const code =
      location.hash.slice(1).toUpperCase();

    if (
      /^[A-HJ-NP-Z2-9]{6}$/.test(code) &&
      S.sc &&
      (
        !S.student ||
        S.student.code !== code
      )
    ) {
      joinClass(code);
    }
  }
);

// Iniciar aplicación
init();

})();
