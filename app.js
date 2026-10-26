class ValidationError extends Error {}

// ===================== Navigation entre les calculatrices =====================

class TabController {
  constructor(boutons, panneaux) {
    this.boutons = boutons;
    this.panneaux = panneaux;
  }
  activer(cible) {
    this.boutons.forEach(bouton => bouton.classList.toggle('actif', bouton.dataset.cible === cible));
    this.panneaux.forEach(panneau => panneau.classList.toggle('actif', panneau.id === `panneau-${cible}`));
  }
  initialiser() {
    this.boutons.forEach(bouton => {
      bouton.addEventListener('click', () => this.activer(bouton.dataset.cible));
    });
  }
}

// ===================== Calculatrice simple =====================
// Chaque opération respecte le même contrat {symbole, executer(a, b)} :
// en ajouter une nouvelle n'oblige à modifier ni Calculator ni le contrôleur (OCP).

const operations = {
  addition: { symbole: "+", executer: (a, b) => a + b },
  soustraction: { symbole: "-", executer: (a, b) => a - b },
  multiplication: { symbole: "×", executer: (a, b) => a * b },
};

class OperationRegistry {
  constructor(operations) {
    this.operations = operations;
  }
  get(cle) {
    const operation = this.operations[cle];
    if (!operation) {
      throw new Error(`Opération inconnue : ${cle}`);
    }
    return operation;
  }
}

class NumberInputValidator {
  valider(valeurBrute) {
    const valeur = parseFloat(valeurBrute);
    if (isNaN(valeur)) {
      throw new ValidationError("Veuillez saisir deux nombres valides.");
    }
    return valeur;
  }
}

class Calculator {
  constructor(registry) {
    this.registry = registry;
  }
  calculer(operationCle, a, b) {
    const operation = this.registry.get(operationCle);
    return { resultat: operation.executer(a, b), symbole: operation.symbole };
  }
}

class ResultFormatter {
  formater(a, b, symbole, resultat) {
    return `${a} ${symbole} ${b} = ${resultat}`;
  }
}

class CalculatorView {
  constructor({ nombre1Input, nombre2Input, operationSelect, resultatDiv }) {
    this.nombre1Input = nombre1Input;
    this.nombre2Input = nombre2Input;
    this.operationSelect = operationSelect;
    this.resultatDiv = resultatDiv;
  }
  lireNombre1() { return this.nombre1Input.value; }
  lireNombre2() { return this.nombre2Input.value; }
  lireOperation() { return this.operationSelect.value; }
  afficherResultat(texte) { this.resultatDiv.textContent = texte; }
}

// Le contrôleur dépend des abstractions (validateur, calculateur, formateur, vue)
// reçues en paramètre, jamais de leur implémentation concrète (DIP).
class CalculatorController {
  constructor(view, validator, calculator, formatter) {
    this.view = view;
    this.validator = validator;
    this.calculator = calculator;
    this.formatter = formatter;
  }
  calculer() {
    try {
      const n1 = this.validator.valider(this.view.lireNombre1());
      const n2 = this.validator.valider(this.view.lireNombre2());
      const operationCle = this.view.lireOperation();
      const { resultat, symbole } = this.calculator.calculer(operationCle, n1, n2);
      this.view.afficherResultat(this.formatter.formater(n1, n2, symbole, resultat));
    } catch (erreur) {
      this.view.afficherResultat(erreur.message);
    }
  }
}

// ===================== Évaluateur d'expressions mathématiques =====================
// Partagé par la calculatrice scientifique et la calculatrice graphique.
// Toute identification non reconnue (ex: "window", "alert") est rejetée avant
// toute traduction/exécution : seuls des nombres, opérateurs, parenthèses et
// identifiants explicitement autorisés peuvent atteindre le code compilé.

const FONCTIONS_MATH = {
  asin: 'Math.asin', acos: 'Math.acos', atan: 'Math.atan',
  sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan',
  sqrt: 'Math.sqrt', abs: 'Math.abs', exp: 'Math.exp',
  log: 'Math.log10', ln: 'Math.log',
};
const CONSTANTES_MATH = { pi: 'Math.PI', e: 'Math.E' };

class IdentifierValidator {
  constructor(identifiantsAutorises) {
    this.identifiantsAutorises = identifiantsAutorises;
  }
  valider(expression) {
    const identifiants = expression.match(/[a-zA-Z_]+/g) || [];
    for (const identifiant of identifiants) {
      if (!this.identifiantsAutorises.has(identifiant.toLowerCase())) {
        throw new ValidationError(`Terme non reconnu : ${identifiant}`);
      }
    }
  }
}

class ExpressionTranslator {
  traduire(expression, modeDegres = false) {
    let resultat = expression.replace(/\^/g, '**');
    const nomsFonctions = Object.keys(FONCTIONS_MATH).sort((a, b) => b.length - a.length).join('|');
    resultat = resultat.replace(new RegExp(`\\b(${nomsFonctions})\\(`, 'gi'), (correspondance, nom) => {
      const nomMinuscule = nom.toLowerCase();
      const estTrigoDirect = ['sin', 'cos', 'tan'].includes(nomMinuscule);
      const conversion = modeDegres && estTrigoDirect ? '(Math.PI/180)*' : '';
      return `${FONCTIONS_MATH[nomMinuscule]}(${conversion}`;
    });
    resultat = resultat.replace(/\b(pi|e)\b/gi, (correspondance, nom) => CONSTANTES_MATH[nom.toLowerCase()]);
    return resultat;
  }
}

class SafeExpressionCompiler {
  constructor(identifierValidator, translator) {
    this.identifierValidator = identifierValidator;
    this.translator = translator;
  }
  compiler(expression, nomsParametres, modeDegres = false) {
    if (!expression.trim()) {
      throw new ValidationError("Expression vide.");
    }
    this.identifierValidator.valider(expression);
    const expressionJs = this.translator.traduire(expression, modeDegres);
    try {
      // eslint-disable-next-line no-new-func
      return new Function(...nomsParametres, `"use strict"; return (${expressionJs});`);
    } catch {
      throw new ValidationError("Expression invalide.");
    }
  }
}

// ===================== Calculatrice scientifique =====================

class ScientificCalculatorView {
  constructor({ affichageInput, erreurDiv, modeBouton }) {
    this.affichageInput = affichageInput;
    this.erreurDiv = erreurDiv;
    this.modeBouton = modeBouton;
  }
  lireExpression() { return this.affichageInput.value; }
  ecrireExpression(valeur) { this.affichageInput.value = valeur; }
  ajouter(texte) { this.affichageInput.value += texte; }
  effacerTout() { this.affichageInput.value = ''; }
  effacerDernier() { this.affichageInput.value = this.affichageInput.value.slice(0, -1); }
  afficherErreur(message) { this.erreurDiv.textContent = message; }
  afficherModeAngle(modeDegres) { this.modeBouton.textContent = modeDegres ? 'Deg' : 'Rad'; }
}

class ScientificCalculatorController {
  constructor(view, compiler) {
    this.view = view;
    this.compiler = compiler;
    this.modeDegres = false;
  }
  basculerMode() {
    this.modeDegres = !this.modeDegres;
    this.view.afficherModeAngle(this.modeDegres);
  }
  ajouter(texte) {
    this.view.ajouter(texte);
  }
  effacerTout() {
    this.view.effacerTout();
    this.view.afficherErreur('');
  }
  effacerDernier() {
    this.view.effacerDernier();
  }
  calculer() {
    try {
      const expression = this.view.lireExpression();
      const fonction = this.compiler.compiler(expression, [], this.modeDegres);
      const resultat = fonction();
      if (typeof resultat !== 'number' || !isFinite(resultat)) {
        throw new ValidationError("Résultat non calculable.");
      }
      this.view.ecrireExpression(String(resultat));
      this.view.afficherErreur('');
    } catch (erreur) {
      this.view.afficherErreur(erreur.message ?? "Erreur de calcul.");
    }
  }
}

// ===================== Calculatrice graphique (façon TI) =====================

class GraphView {
  constructor({ xMin, xMax, yMin, yMax }) {
    this.xMinInitial = xMin;
    this.xMaxInitial = xMax;
    this.yMinInitial = yMin;
    this.yMaxInitial = yMax;
    this.reinitialiser();
  }
  reinitialiser() {
    this.xMin = this.xMinInitial;
    this.xMax = this.xMaxInitial;
    this.yMin = this.yMinInitial;
    this.yMax = this.yMaxInitial;
  }
  zoomer(facteur) {
    const centreX = (this.xMin + this.xMax) / 2;
    const centreY = (this.yMin + this.yMax) / 2;
    const largeur = (this.xMax - this.xMin) * facteur;
    const hauteur = (this.yMax - this.yMin) * facteur;
    this.xMin = centreX - largeur / 2;
    this.xMax = centreX + largeur / 2;
    this.yMin = centreY - hauteur / 2;
    this.yMax = centreY + hauteur / 2;
  }
  deplacer(dx, dy) {
    this.xMin += dx; this.xMax += dx;
    this.yMin += dy; this.yMax += dy;
  }
}

class GraphRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }
  xVersPixel(x, vue) {
    return ((x - vue.xMin) / (vue.xMax - vue.xMin)) * this.canvas.width;
  }
  yVersPixel(y, vue) {
    return this.canvas.height - ((y - vue.yMin) / (vue.yMax - vue.yMin)) * this.canvas.height;
  }
  calculerPas(etendue) {
    const brut = etendue / 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(brut)));
    const normalise = brut / magnitude;
    let pas;
    if (normalise < 1.5) pas = 1;
    else if (normalise < 3.5) pas = 2;
    else if (normalise < 7.5) pas = 5;
    else pas = 10;
    return pas * magnitude;
  }
  dessinerGrille(vue) {
    const { ctx, canvas } = this;
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    const pasX = this.calculerPas(vue.xMax - vue.xMin);
    const pasY = this.calculerPas(vue.yMax - vue.yMin);
    for (let x = Math.ceil(vue.xMin / pasX) * pasX; x <= vue.xMax; x += pasX) {
      const px = this.xVersPixel(x, vue);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height); ctx.stroke();
    }
    for (let y = Math.ceil(vue.yMin / pasY) * pasY; y <= vue.yMax; y += pasY) {
      const py = this.yVersPixel(y, vue);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
    }
  }
  dessinerAxes(vue) {
    const { ctx, canvas } = this;
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.5;
    const pxZeroX = this.xVersPixel(0, vue);
    const pxZeroY = this.yVersPixel(0, vue);
    ctx.beginPath(); ctx.moveTo(0, pxZeroY); ctx.lineTo(canvas.width, pxZeroY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pxZeroX, 0); ctx.lineTo(pxZeroX, canvas.height); ctx.stroke();
  }
  dessinerCourbe(fonction, vue) {
    const { ctx, canvas } = this;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let pointPrecedentValide = false;
    let pyPrecedent = null;
    for (let px = 0; px <= canvas.width; px++) {
      const x = vue.xMin + (px / canvas.width) * (vue.xMax - vue.xMin);
      let y;
      try { y = fonction(x); } catch { y = NaN; }
      if (typeof y !== 'number' || !isFinite(y)) {
        pointPrecedentValide = false;
        continue;
      }
      const py = this.yVersPixel(y, vue);
      const sautBrusque = pyPrecedent !== null && Math.abs(py - pyPrecedent) > canvas.height * 0.9;
      if (!pointPrecedentValide || sautBrusque) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
      pointPrecedentValide = true;
      pyPrecedent = py;
    }
    ctx.stroke();
  }
  dessiner(fonction, vue) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.dessinerGrille(vue);
    this.dessinerAxes(vue);
    if (fonction) {
      this.dessinerCourbe(fonction, vue);
    }
  }
}

class GraphingCalculatorController {
  constructor({ fonctionInput, erreurDiv, canvas }, compiler, view, renderer) {
    this.fonctionInput = fonctionInput;
    this.erreurDiv = erreurDiv;
    this.canvas = canvas;
    this.compiler = compiler;
    this.view = view;
    this.renderer = renderer;
    this.fonctionCourante = null;
  }
  tracer() {
    try {
      const expression = this.fonctionInput.value;
      this.fonctionCourante = this.compiler.compiler(expression, ['x']);
      this.erreurDiv.textContent = '';
    } catch (erreur) {
      this.fonctionCourante = null;
      this.erreurDiv.textContent = erreur.message ?? "Expression invalide.";
    }
    this.redessiner();
  }
  redessiner() {
    this.renderer.dessiner(this.fonctionCourante, this.view);
  }
  zoomer(facteur) {
    this.view.zoomer(facteur);
    this.redessiner();
  }
  reinitialiserVue() {
    this.view.reinitialiser();
    this.redessiner();
  }
  deplacer(dxPixelsCss, dyPixelsCss) {
    const rect = this.canvas.getBoundingClientRect();
    const dx = (dxPixelsCss / rect.width) * (this.view.xMax - this.view.xMin);
    const dy = -(dyPixelsCss / rect.height) * (this.view.yMax - this.view.yMin);
    this.view.deplacer(-dx, dy);
    this.redessiner();
  }
}

// ===================== Initialisation =====================

document.addEventListener('DOMContentLoaded', () => {
  new TabController(
    Array.from(document.querySelectorAll('.menu-item')),
    Array.from(document.querySelectorAll('.panneau'))
  ).initialiser();

  // --- Calculatrice simple ---
  const vueSimple = new CalculatorView({
    nombre1Input: document.getElementById('nombre1'),
    nombre2Input: document.getElementById('nombre2'),
    operationSelect: document.getElementById('operation'),
    resultatDiv: document.getElementById('resultat'),
  });
  const controleurSimple = new CalculatorController(
    vueSimple,
    new NumberInputValidator(),
    new Calculator(new OperationRegistry(operations)),
    new ResultFormatter()
  );
  document.getElementById('calculerBtn').addEventListener('click', () => controleurSimple.calculer());

  // --- Calculatrice scientifique ---
  const translator = new ExpressionTranslator();
  const identifiantsScientifique = new Set([...Object.keys(FONCTIONS_MATH), ...Object.keys(CONSTANTES_MATH)]);
  const compilateurScientifique = new SafeExpressionCompiler(
    new IdentifierValidator(identifiantsScientifique),
    translator
  );
  const vueScientifique = new ScientificCalculatorView({
    affichageInput: document.getElementById('sci-affichage'),
    erreurDiv: document.getElementById('sci-erreur'),
    modeBouton: document.getElementById('sci-mode'),
  });
  const controleurScientifique = new ScientificCalculatorController(vueScientifique, compilateurScientifique);

  document.querySelector('.sci-grille').addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button');
    if (!bouton) return;
    if (bouton.dataset.valeur !== undefined) {
      controleurScientifique.ajouter(bouton.dataset.valeur);
    } else if (bouton.dataset.action === 'ac') {
      controleurScientifique.effacerTout();
    } else if (bouton.dataset.action === 'del') {
      controleurScientifique.effacerDernier();
    } else if (bouton.dataset.action === 'egal') {
      controleurScientifique.calculer();
    } else if (bouton.dataset.action === 'mode') {
      controleurScientifique.basculerMode();
    }
  });
  document.getElementById('sci-affichage').addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') {
      evenement.preventDefault();
      controleurScientifique.calculer();
    }
  });

  // --- Calculatrice graphique ---
  const identifiantsGraphique = new Set([...Object.keys(FONCTIONS_MATH), ...Object.keys(CONSTANTES_MATH), 'x']);
  const compilateurGraphique = new SafeExpressionCompiler(
    new IdentifierValidator(identifiantsGraphique),
    translator
  );
  const canvas = document.getElementById('graphCanvas');
  const demiLargeurInitiale = 10;
  const demiHauteurInitiale = demiLargeurInitiale * (canvas.height / canvas.width);
  const vueGraphique = new GraphView({
    xMin: -demiLargeurInitiale, xMax: demiLargeurInitiale,
    yMin: -demiHauteurInitiale, yMax: demiHauteurInitiale,
  });
  const controleurGraphique = new GraphingCalculatorController(
    {
      fonctionInput: document.getElementById('fonction'),
      erreurDiv: document.getElementById('grapheErreur'),
      canvas,
    },
    compilateurGraphique,
    vueGraphique,
    new GraphRenderer(canvas)
  );

  document.getElementById('tracerBtn').addEventListener('click', () => controleurGraphique.tracer());
  document.getElementById('fonction').addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') {
      evenement.preventDefault();
      controleurGraphique.tracer();
    }
  });
  document.getElementById('zoomPlus').addEventListener('click', () => controleurGraphique.zoomer(0.8));
  document.getElementById('zoomMoins').addEventListener('click', () => controleurGraphique.zoomer(1.25));
  document.getElementById('reinitialiserVue').addEventListener('click', () => controleurGraphique.reinitialiserVue());

  canvas.addEventListener('wheel', (evenement) => {
    evenement.preventDefault();
    controleurGraphique.zoomer(evenement.deltaY > 0 ? 1.1 : 0.9);
  }, { passive: false });

  let glisserActif = false;
  let dernierX = 0;
  let dernierY = 0;
  canvas.addEventListener('mousedown', (evenement) => {
    glisserActif = true;
    dernierX = evenement.clientX;
    dernierY = evenement.clientY;
  });
  window.addEventListener('mousemove', (evenement) => {
    if (!glisserActif) return;
    const dx = evenement.clientX - dernierX;
    const dy = evenement.clientY - dernierY;
    dernierX = evenement.clientX;
    dernierY = evenement.clientY;
    controleurGraphique.deplacer(dx, dy);
  });
  window.addEventListener('mouseup', () => { glisserActif = false; });

  controleurGraphique.redessiner();
});
