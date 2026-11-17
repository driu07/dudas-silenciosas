
/*
  DUDAI
  Generador inteligente de guías de auxiliaría
*/

(() => {
  "use strict";

  let contexto = null;
  let guia = null;
  let generando = false;

  const escapar = valor =>
    String(valor ?? "").replace(
      /[&<>"']/g,
      c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
    );

  const nombreArchivo = valor =>
    String(valor || "clase")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

  // ======================================
  // INTERFAZ DEL GENERADOR
  // ======================================

  function cerrar() {
    document
      .getElementById("ds-guia-modal")
      ?.remove();
  }

  function ventana(contenido) {
    let modal = document.getElementById(
      "ds-guia-modal"
    );

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "ds-guia-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <style>
        #ds-guia-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          overflow: auto;
          background: #0b1820b8;
          padding: 22px 12px;
          font: 15px/1.5 system-ui;
        }

        #ds-guia-modal .panel {
          box-sizing: border-box;
          max-width: 860px;
          margin: auto;
          background: #fff;
          color: #162b30;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 16px 48px #0005;
        }

        #ds-guia-modal .fila {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        #ds-guia-modal .fila > * {
          flex: 1;
        }

        #ds-guia-modal h2,
        #ds-guia-modal h3 {
          margin: 0 0 10px;
        }

        #ds-guia-modal label {
          display: block;
          margin: 12px 0;
          font-weight: 600;
        }

        #ds-guia-modal select,
        #ds-guia-modal textarea {
          box-sizing: border-box;
          width: 100%;
          margin-top: 5px;
          padding: 9px;
          border: 1px solid #a9c0c3;
          border-radius: 8px;
          background: #fff;
          color: #162b30;
          font: inherit;
        }

        #ds-guia-modal textarea {
          min-height: 95px;
          resize: vertical;
        }

        #ds-guia-modal button {
          padding: 10px 14px;
          border: 1px solid #b9caca;
          border-radius: 8px;
          background: #fff;
          color: #163238;
          cursor: pointer;
        }

        #ds-guia-modal button.primario {
          background: #17666d;
          border-color: #17666d;
          color: #fff;
        }

        #ds-guia-modal button:disabled {
          opacity: .55;
          cursor: wait;
        }

        #ds-guia-modal .ejercicio {
          border: 1px solid #d4e1e3;
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
        }

        #ds-guia-modal .muted {
          color: #526a70;
          font-size: 13px;
        }
      </style>

      <main class="panel">
        <div class="fila">
          <h2>
            Guía inteligente para auxiliaría
          </h2>

          <button
            type="button"
            id="ga-cerrar"
            style="flex:0">
            Cerrar
          </button>
        </div>

        ${contenido}
      </main>
    `;

    modal
      .querySelector("#ga-cerrar")
      .addEventListener("click", cerrar);

    return modal;
  }

  // ======================================
  // ABRIR GENERADOR
  // ======================================

  function abrir({
    client,
    clase,
    analisis
  }) {
    if (!client || !clase?.id) {
      alert(
        "Primero debes abrir una clase como profesor."
      );
      return;
    }

    contexto = {
      client,
      clase,
      analisis
    };

    guia = null;

    const modal = ventana(`
      <p>
        Curso:
        <strong>${escapar(clase.title)}</strong>
      </p>

      <p class="muted">
        La guía utilizará las dudas visibles
        de esta clase. Revisa los resultados
        matemáticos antes de compartirlos.
      </p>

      <form id="ga-formulario">

        <div class="fila">

          <label>
            Duración

            <select name="duracion">
              <option value="45">
                45 minutos
              </option>

              <option value="60" selected>
                60 minutos
              </option>

              <option value="90">
                90 minutos
              </option>
            </select>
          </label>

          <label>
            Cantidad de ejercicios

            <select name="cantidad">
              <option value="3">
                3 ejercicios
              </option>

              <option value="5" selected>
                5 ejercicios
              </option>

              <option value="8">
                8 ejercicios
              </option>
            </select>
          </label>

        </div>

        <label>
          Dificultad

          <select name="dificultad">
            <option value="basica">
              Básica
            </option>

            <option value="progresiva" selected>
              Progresiva
            </option>

            <option value="desafiante">
              Desafiante
            </option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            name="repaso"
            checked
          >
          Incluir repaso conceptual
        </label>

        <button
          type="submit"
          id="ga-generar"
          class="primario">
          Generar con Gemini
        </button>

        <p
          role="status"
          id="ga-mensaje">
        </p>

      </form>
    `);

    modal
      .querySelector("#ga-formulario")
      .addEventListener("submit", generar);
  }

  // ======================================
  // GENERAR EJERCICIOS CON GEMINI
  // ======================================


async function generar(evento) {
  evento.preventDefault();

  if (generando) return;

  generando = true;

  const formulario = evento.currentTarget;

  const boton = formulario.querySelector(
    "#ga-generar"
  );

  const mensaje = formulario.querySelector(
    "#ga-mensaje"
  );

  const opciones = new FormData(
    formulario
  );

  const total = Number(
    opciones.get("cantidad")
  );

  const resultados = [];

  let resumen = "";
  let repaso = "";
  let objetivos = [];

  boton.disabled = true;

  try {
    for (let i = 1; i <= total; i++) {

      mensaje.textContent =
        `Generando ejercicio ${i} de ${total}…`;

      const {
        data,
        error
      } = await contexto.client.functions.invoke(
        "generar-guia-auxiliar",
        {
          body: {
            classId: contexto.clase.id,

            numeroEjercicio: i,

            totalEjercicios: total,

            duracion: Number(
              opciones.get("duracion")
            ),

            dificultad: String(
              opciones.get("dificultad")
            ),

            incluirRepaso:
              opciones.has("repaso"),

            anteriores: resultados.map(
              e => e.titulo + ": " + e.concepto
            ),

            analisis: {
              resumen:
                contexto.analisis?.summary || "",

              temas:
                (contexto.analisis?.topics || [])
                  .slice(0, 6)
                  .map(t => t.label)
            }
          }
        }
      );

      if (error) {
        let detalle = "";

        try {
          detalle =
            (await error.context?.json?.())
              ?.error || "";
        } catch {}

        throw new Error(
          detalle || error.message
        );
      }

      if (
        !data?.ok ||
        data.guia?.ejercicios?.length !== 1
      ) {
        throw new Error(
          data?.error ||
          "Gemini devolvió un ejercicio no válido."
        );
      }

      resultados.push(
        data.guia.ejercicios[0]
      );

      if (i === 1) {
        resumen =
          data.guia.resumen || "";

        repaso =
          data.guia.repaso || "";

        objetivos =
          data.guia.objetivos || [];
      }
    }

    guia = {
      resumen,
      repaso,
      objetivos,
      ejercicios: resultados
    };

    mostrarEdicion();

  } catch (error) {
    mensaje.textContent =
      `Error después de ${resultados.length} ejercicio(s): ` +
      (error.message || String(error));

  } finally {
    generando = false;
    boton.disabled = false;
  }
}


  // ======================================
  // REVISIÓN DOCENTE
  // ======================================

  function mostrarEdicion() {
    const modal = ventana(`
      <p class="muted">
        Edita los enunciados y las respuestas
        antes de exportar.

        Los cambios se perderán al cerrar
        esta ventana.
      </p>

      <label>
        Resumen del diagnóstico

        <textarea
          data-campo="resumen">${escapar(
            guia.resumen
          )}</textarea>
      </label>

      <label>
        Repaso conceptual

        <textarea
          data-campo="repaso">${escapar(
            guia.repaso
          )}</textarea>
      </label>

      ${guia.ejercicios.map(
        (e, indice) => `
          <section class="ejercicio">

            <h3>
              ${indice + 1}.
              ${escapar(e.titulo)}
            </h3>

            <p class="muted">
              ${escapar(e.concepto)}
              · ${Number(e.minutos) || 0}
              minutos
            </p>

            <label>
              Enunciado

              <textarea
                data-campo="enunciado"
                data-indice="${indice}">${escapar(
                  e.enunciado
                )}</textarea>
            </label>

            <label>
              Solución paso a paso

              <textarea
                data-campo="solucion"
                data-indice="${indice}">${escapar(
                  e.solucion
                )}</textarea>
            </label>

            <label>
              Error frecuente

              <textarea
                data-campo="error_frecuente"
                data-indice="${indice}">${escapar(
                  e.error_frecuente
                )}</textarea>
            </label>

          </section>
        `
      ).join("")}

      <div class="fila">

        <button
          class="primario"
          type="button"
          id="ga-pdf-guia">
          Guía → PDF
        </button>

        <button
          class="primario"
          type="button"
          id="ga-pdf-pauta">
          Pauta → PDF
        </button>

        <button
          type="button"
          id="ga-tex-guia">
          Guía .tex
        </button>

        <button
          type="button"
          id="ga-tex-pauta">
          Pauta .tex
        </button>

      </div>

      <p class="muted">
        Los PDF se guardan desde la impresión
        del navegador.

        Los archivos .tex se pueden
        compilar en Overleaf.
      </p>
    `);

    modal
      .querySelectorAll(
        "textarea[data-campo]"
      )
      .forEach(area => {
        area.addEventListener("input", () => {
          if (
            area.dataset.indice === undefined
          ) {
            guia[area.dataset.campo] =
              area.value;

          } else {
            guia.ejercicios[
              Number(area.dataset.indice)
            ][area.dataset.campo] =
              area.value;
          }
        });
      });

    modal.querySelector(
      "#ga-pdf-guia"
    ).onclick = () => imprimir(false);

    modal.querySelector(
      "#ga-pdf-pauta"
    ).onclick = () => imprimir(true);

    modal.querySelector(
      "#ga-tex-guia"
    ).onclick = () => descargarTex(false);

    modal.querySelector(
      "#ga-tex-pauta"
    ).onclick = () => descargarTex(true);
  }

  // ======================================
  // CONVERTIR CONTENIDO A LATEX
  // ======================================

  function aLatex(valor) {
    const escaparTexto = texto =>
      texto.replace(
        /[\\{}%$&#_^~]/g,
        caracter => ({
          "\\": "\\textbackslash{}",
          "{": "\\{",
          "}": "\\}",
          "%": "\\%",
          "$": "\\$",
          "&": "\\&",
          "#": "\\#",
          "_": "\\_",
          "^": "\\textasciicircum{}",
          "~": "\\textasciitilde{}"
        }[caracter])
      ).replace(
        /\r?\n/g,
        "\\par\n"
      );

    const permitidos = new Set((
      "frac dfrac tfrac sqrt left right " +
      "cdot times div pm mp neq ne leq le " +
      "geq ge approx sim infty sum prod " +
      "int iint lim to rightarrow implies " +
      "iff forall exists partial nabla " +
      "alpha beta gamma delta epsilon " +
      "theta lambda mu pi sigma phi omega " +
      "vec overline hat bar text mathrm " +
      "mathbf mathbb operatorname begin " +
      "end cases aligned matrix pmatrix " +
      "bmatrix gathered binom boxed log " +
      "ln sin cos tan exp max min gcd " +
      "ldots dots quad qquad lefteqn " +
      "equiv in notin subset subseteq " +
      "cup cap bigcup bigcap geqslant " +
      "leqslant circ ast land lor neg " +
      "cdots vdots ddots"
    ).split(/\s+/));

    const entornos = new Set([
      "aligned",
      "cases",
      "matrix",
      "pmatrix",
      "bmatrix",
      "gathered"
    ]);

    const patron =
      /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;

    const original = String(valor ?? "");

    let pos = 0;
    let salida = "";

    for (const match of original.matchAll(
      patron
    )) {
      salida += escaparTexto(
        original.slice(pos, match.index)
      );

      const formula =
        match[1] ?? match[2];

      const comandos = [
        ...formula.matchAll(/\\([a-zA-Z]+)/g)
      ].map(m => m[1]);

      const ent = [
        ...formula.matchAll(
          /\\(?:begin|end)\s*\{([^}]+)\}/g
        )
      ].map(m => m[1]);

      const aceptable =
        formula.length <= 1000 &&
        comandos.every(
          c => permitidos.has(c)
        ) &&
        ent.every(
          e => entornos.has(e)
        ) &&
        !/[\u0000-\u001f]/.test(formula);

      salida += aceptable
        ? (
            match[1] !== undefined
              ? `\\(${formula}\\)`
              : `\\[${formula}\\]`
          )
        : "\\textbf{[Fórmula requiere revisión]}";

      pos =
        match.index + match[0].length;
    }

    return salida +
      escaparTexto(
        original.slice(pos)
      );
  }

  // ======================================
  // GENERAR DOCUMENTO LATEX
  // ======================================

  function crearTex(pauta) {
    const clase = contexto.clase;

    let codigo = String.raw`
\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish]{babel}
\usepackage{amsmath,amssymb}
\usepackage{geometry}
\geometry{margin=2.2cm}
\setlength{\parskip}{6pt}
\begin{document}
`;

    codigo += `
\\begin{center}
{\\Large\\bfseries ${
  pauta
    ? "Pauta de soluciones"
    : "Guía de ejercicios"
}}\\\\[5pt]

{\\large ${aLatex(clase.title)}}\\\\

${aLatex(
  clase.topic || "Clase auxiliar"
)}

\\end{center}
\\hrule
`;

    codigo += `
\\section*{Propósito de la clase}

${aLatex(guia.resumen)}
`;

    if (guia.repaso) {
      codigo += `
\\section*{Repaso conceptual}

${aLatex(guia.repaso)}
`;
    }

    if (
      Array.isArray(guia.objetivos) &&
      guia.objetivos.length
    ) {
      codigo += `
\\section*{Objetivos de aprendizaje}
\\begin{itemize}
`;

      for (const objetivo of guia.objetivos) {
        codigo += `
\\item ${aLatex(objetivo)}
`;
      }

      codigo += `
\\end{itemize}
`;
    }

    codigo += `
\\section*{Ejercicios}
\\begin{enumerate}
`;

    for (const e of guia.ejercicios) {
      codigo += `
\\item
\\textbf{${aLatex(e.titulo)}}
(${Number(e.minutos) || 0} min)

${aLatex(e.enunciado)}
`;

      if (pauta) {
        codigo += `
\\par
\\textbf{Solución:}

${aLatex(e.solucion)}

\\par
\\textit{Error frecuente:
${aLatex(e.error_frecuente)}}
`;

      } else {
        codigo += `
\\vspace{12mm}
`;
      }
    }

    codigo += `
\\end{enumerate}
\\end{document}
`;

    return codigo;
  }

  // ======================================
  // DESCARGAR ARCHIVOS .TEX
  // ======================================

  function descargarTex(pauta) {
    const contenido = crearTex(pauta);

    const blob = new Blob(
      [contenido],
      {
        type: "text/plain;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);

    const enlace =
      document.createElement("a");

    enlace.href = url;

    enlace.download =
      `${
        pauta ? "pauta" : "guia"
      }-${nombreArchivo(
        contexto.clase.title
      )}.tex`;

    document.body.appendChild(enlace);

    enlace.click();
    enlace.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      20000
    );
  }

  // ======================================
  // GENERAR VISTA IMPRIMIBLE PDF
  // ======================================

  function imprimir(pauta) {
    const ventanaPDF =
      window.open("", "_blank");

    if (!ventanaPDF) {
      alert(
        "Permite ventanas emergentes para guardar el PDF."
      );
      return;
    }

    const clase = contexto.clase;

    const html = `
<!doctype html>
<html lang="es">

<head>
  <meta charset="UTF-8">

  <title>
    ${pauta ? "Pauta" : "Guía"}
    - ${escapar(clase.title)}
  </title>

  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css"
  >

  <script
    defer
    src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js">
  </script>

  <script
    defer
    src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.min.js">
  </script>

  <style>
    @page {
      size: A4;
      margin: 20mm;
    }

    body {
      font: 15px/1.6 Georgia, serif;
      color: #162b30;
    }

    h1, h2, h3 {
      font-family: Arial, sans-serif;
    }

    h1 {
      text-align: center;
      font-size: 24px;
    }

    .sub {
      text-align: center;
      color: #496a70;
    }

    hr {
      border: 0;
      border-top: 1px solid #c8dadd;
    }

    .ej {
      break-inside: avoid;
      margin: 22px 0;
    }

    .sol {
      border-left: 3px solid #7d9da3;
      padding-left: 12px;
    }

    .texto {
      white-space: pre-wrap;
    }

    .imprimir {
      margin: 12px 0;
      padding: 9px;
    }

    @media print {
      .imprimir {
        display: none;
      }
    }
  </style>
</head>

<body>

  <button
    class="imprimir"
    onclick="window.print()">
    Imprimir / Guardar como PDF
  </button>

  <h1>
    ${
      pauta
        ? "Pauta de soluciones"
        : "Guía de ejercicios"
    }
  </h1>

  <div class="sub">
    ${escapar(clase.title)}
    —
    ${escapar(
      clase.topic || "Clase auxiliar"
    )}
  </div>

  <hr>

  <h2>Objetivos de aprendizaje</h2>

  <ul>
    ${(guia.objetivos || [])
      .map(
        objetivo =>
          `<li>${escapar(objetivo)}</li>`
      )
      .join("")}
  </ul>

  <h2>Diagnóstico pedagógico</h2>

  <div class="texto">
    ${escapar(guia.resumen)}
  </div>

  ${
    guia.repaso
      ? `
        <h2>Repaso conceptual</h2>

        <div class="texto">
          ${escapar(guia.repaso)}
        </div>
      `
      : ""
  }

  <h2>Ejercicios</h2>

  ${guia.ejercicios
    .map(
      (e, i) => `
        <section class="ej">

          <h3>
            ${i + 1}.
            ${escapar(e.titulo)}
            (${Number(e.minutos) || 0} min)
          </h3>

          <div class="texto">
            ${escapar(e.enunciado)}
          </div>

          ${
            pauta
              ? `
                <div class="sol">

                  <strong>
                    Solución paso a paso
                  </strong>

                  <div class="texto">
                    ${escapar(e.solucion)}
                  </div>

                  <p>
                    <strong>Error frecuente:</strong>
                    ${escapar(e.error_frecuente)}
                  </p>

                </div>
              `
              : ""
          }

        </section>
      `
    )
    .join("")}

</body>
</html>
`;

    ventanaPDF.addEventListener(
      "load",
      () => {
        try {
          if (
            typeof ventanaPDF
              .renderMathInElement ===
            "function"
          ) {
            ventanaPDF.renderMathInElement(
              ventanaPDF.document.body,
              {
                delimiters: [
                  {
                    left: "\\[",
                    right: "\\]",
                    display: true
                  },
                  {
                    left: "\\(",
                    right: "\\)",
                    display: false
                  }
                ],

                throwOnError: false,
                trust: false
              }
            );
          }

        } catch (error) {
          console.warn(
            "No fue posible renderizar una fórmula",
            error
          );
        }
      },
      { once: true }
    );

    ventanaPDF.document.open();
    ventanaPDF.document.write(html);
    ventanaPDF.document.close();
  }

  // ======================================
  // EXPONER EL MÓDULO A APP.JS
  // ======================================

  window.DS_GUIAS = {
    abrir
  };

})();
