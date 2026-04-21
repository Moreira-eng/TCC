// REMOVA TODOS OS IMPORTS DO FIREBASE DO TOPO
// O arquivo deve começar diretamente com as definições das variáveis globais:

const appId = 'lifesupport-pro-v1';
let currentUser = null;
let attempts = [];
let currentQIndex = 0;
let currentFIndex = 0; 
let sessionResults = [];
let finalExamResults = [];
let learningChartInstance = null;

// Coloque esta função aqui para evitar erros de histórico vazio
window.renderDashboard = () => { console.log("Modo offline ativo."); };

// ACORDEÃO
window.toggleAccordion = (button) => {
    const item = button.parentElement;
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
    if (!isActive) {
        item.classList.add('active');
    }
};

// --- LÓGICA DO DARK MODE ---
window.toggleTheme = () => {
    // 1. Altera a classe na tag <html> (Raiz do site)
    const isDark = document.documentElement.classList.toggle('dark');
    
    // 2. Localiza os ícones
    const moon = document.getElementById('moon-icon');
    const sun = document.getElementById('sun-icon');
    
    // 3. Atualiza os ícones visualmente
    if (moon && sun) {
        if (isDark) {
            moon.classList.add('hidden');
            sun.classList.remove('hidden');
        } else {
            moon.classList.remove('hidden');
            sun.classList.add('hidden');
        }
    }
    
    // 4. Salva no navegador para não perder ao recarregar
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// Adicione isso ao final do script.js para carregar o tema salvo
if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
}

// METRÔNOMO
let metroState = {
    isRunning: false,
    bpm: 110,
    interval: null,
    audioCtx: null
};

window.setBPM = (val) => {
    metroState.bpm = val;
    document.querySelectorAll('.bpm-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'shadow-lg', 'scale-105', 'dark:bg-blue-700');
        if (b.id === `bpm-${val}`) b.classList.add('bg-blue-600', 'shadow-lg', 'scale-105', 'dark:bg-blue-700');
    });
    const display = document.getElementById('bpm-display');
    if(display) display.innerHTML = `${val} <span class="text-[10px] uppercase opacity-60">BPM</span>`;
    
    if (metroState.isRunning) {
        window.stopMetronome();
        window.startMetronome();
    }
};

window.startMetronome = () => {
    if (!metroState.audioCtx) {
        metroState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (metroState.audioCtx.state === 'suspended') {
        metroState.audioCtx.resume();
    }
    const ms = 60000 / metroState.bpm;
    const btn = document.getElementById('metro-toggle');
    const ring = document.getElementById('metro-pulse-ring');
    metroState.interval = setInterval(() => {
        window.playTick();
        window.triggerPulse();
    }, ms);
    metroState.isRunning = true;
    btn.innerText = "Parar Batida";
    btn.classList.replace('bg-white', 'bg-rose-600');
    btn.classList.replace('text-blue-900', 'text-white');
    if(ring) {
        ring.style.animationDuration = `${ms/1000}s`;
        ring.classList.add('pulse-active');
    }
};

window.stopMetronome = () => {
    const btn = document.getElementById('metro-toggle');
    const ring = document.getElementById('metro-pulse-ring');
    clearInterval(metroState.interval);
    metroState.isRunning = false;
    btn.innerText = "Iniciar Batida";
    btn.classList.replace('bg-rose-600', 'bg-white');
    btn.classList.replace('text-white', 'text-blue-900');
    if(ring) ring.classList.remove('pulse-active');
};

window.toggleMetronome = () => {
    if (metroState.isRunning) window.stopMetronome();
    else window.startMetronome();
};

window.playTick = () => {
    const osc = metroState.audioCtx.createOscillator();
    const gain = metroState.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, metroState.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, metroState.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, metroState.audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(metroState.audioCtx.destination);
    osc.start(); osc.stop(metroState.audioCtx.currentTime + 0.1);
};

window.triggerPulse = () => {
    const visual = document.getElementById('metro-visual');
    if (visual) {
        visual.classList.add('scale-105', 'bg-blue-600/70', 'dark:bg-slate-700/70');
        setTimeout(() => visual.classList.remove('scale-105', 'bg-blue-600/70', 'dark:bg-slate-700/70'), 100);
    }
};

// DADOS QUIZ
const quizQuestions = [
    { cat: "Segurança", q: "Qual a prioridade absoluta ao abordar uma vítima caída?", opts: ["Pulso.", "Segurança cena.", "Iniciar RCP.", "Gritar."], correct: 1, explanation: "Segurança zero: não se torne uma vítima." },
    { cat: "Avaliação", q: "Como testar responsividade de um adulto?", opts: ["Tapa.", "Chamar e bater ombros.", "Sacudir tronco.", "Gritar perto."], correct: 1, explanation: "Firmeza nos ombros e voz alta." },
    { cat: "Leigos", q: "Qual é a recomendação para leigos não treinados em RCP?", opts: ["Ventilar.", "Só compressão.", "Fazer 30:2.", "Esperar parado."], correct: 1, explanation: "Hands-Only simplifica e oxigena." },
    { cat: "Técnica", q: "Qual é a frequência ideal das compressões?", opts: ["80 BPM.", "100-120 BPM.", "O mais rápido.", "60 BPM."], correct: 1, explanation: "Frequência ótima para perfusão." },
    { cat: "Técnica", q: "Qual a profundidade ideal das compressões no Adulto?", opts: ["2cm.", "4cm.", "5-6cm.", "8cm."], correct: 2, explanation: "Menos é ineficaz, mais causa trauma." },
    { cat: "Mecânica", q: "Por que permitir o recuo total do tórax?", opts: ["Descansar.", "Reenchimento cardíaco.", "Evitar dor.", "Sinal de fim."], correct: 1, explanation: "O sangue precisa entrar no coração para sair." },
    { cat: "Protocolo", q: "Relação C:V Adulto?", opts: ["15:2.", "30:2.", "50:2.", "Só C."], correct: 1, explanation: "Padrão ouro em via aérea básica." },
    { cat: "Equipamento", q: "DEA chegou. qual é a 1ª ação?", opts: ["Colar pás.", "Ligar.", "Pedir afastar.", "Trocar colega."], correct: 1, explanation: "Ligar inicia o protocolo por voz." },
    { cat: "OVACE", q: "Vítima tosse ruidosamente. Conduta?", opts: ["Heimlich.", "Bater costas.", "Só encorajar a tosse.", "RCP."], correct: 2, explanation: "Tosse parcial é o mecanismo mais eficaz." },
    { cat: "Fisiologia", q: "Interpretação do 'Gasping'?", opts: ["Melhora.", "Normal.", "Sinal de PCR.", "Acordando."], correct: 2, explanation: "Não é funcional. Inicie RCP." },
    { cat: "OVACE", q: "Protocolo desengasgo consciente grave?", opts: ["Só Heimlich.", "5 tapas + 5 compressões.", "Dar água.", "Bater peito."], correct: 1, explanation: "Alternância de pressão integrada." },
    { cat: "Gestantes", q: "Qual é o local de compressões em gestantes engasgadas?", opts: ["Abdômen.", "Centro tórax.", "Nas pernas.", "Só tapas."], correct: 1, explanation: "Anatomia impede manobra abdominal." },
    { cat: "Lactentes", q: "Qual é a conduta adequada para desengasgo Bebê (< 1 ano)?", opts: ["Heimlich.", "Elevar pernas.", "5 tapas + 5 comp peito.", "Sacudir."], correct: 2, explanation: "Heimlich abdominal lesiona órgãos de bebês." },
    { cat: "Fisiologia", q: "O cérebro sofre dano tecidual por hipóxia após:", opts: ["1 min.", "4-6 min.", "30 min.", "1 hora."], correct: 1, explanation: "Janela crítica de oportunidade." },
    { cat: "Fadiga", q: "Por que trocar compressor (socorrista) a cada 2 min?", opts: ["Cansaço mental.", "Cansaço físico reduz qualidade.", "Ficha técnica.", "Regra aleatória."], correct: 1, explanation: "Fadiga reduz profundidade mesmo sem dor." }
];

const finalExamQuestions = [
    { level: "Fácil", cat: "Protocolo", q: "Qual o número de emergência para o SAMU no Brasil?", opts: ["190", "192", "193", "911"], correct: 1 },
    { level: "Fácil", cat: "Segurança", q: "Ao ver uma pessoa caída, qual a primeira coisa a fazer?", opts: ["Checar pulso", "Gritar socorro", "Garantir a segurança da cena", "Fazer respiração"], correct: 2 },
    { level: "Fácil", cat: "Técnica", q: "Qual a relação compressão:ventilação recomendada para um adulto?", opts: ["15:2", "30:2", "30:5", "Apenas 100 compressões"], correct: 1 },
    { level: "Fácil", cat: "Equipamento", q: "O que significa a sigla DEA?", opts: ["Dispositivo Elétrico de Apoio", "Desfibrilador Externo Automático", "Detector de Espasmo Agudo", "Diretriz de Emergência Aplicada"], correct: 1 },
    { level: "Fácil", cat: "OVACE", q: "Qual o sinal universal de asfixia/engasgo?", opts: ["Mão no peito", "Mãos no pescoço", "Mão na testa", "Apontar para a boca"], correct: 1 },
    { level: "Média", cat: "Técnica", q: "Qual a frequência correta de compressões no SBV Adulto?", opts: ["60 a 80 por minuto", "80 a 100 por minuto", "100 a 120 por minuto", "O mais rápido possível"], correct: 2 },
    { level: "Média", cat: "Fisiologia", q: "A 'Morte Clínica' é considerada:", opts: ["Estado irreversível", "Estado de morte cerebral confirmada", "Estado reversível logo após a parada", "Estado após 20 minutos de PCR"], correct: 2 },
    { level: "Média", cat: "Técnica", q: "Qual a profundidade ideal das compressões em um adulto?", opts: ["Mínimo 2 cm", "Entre 5 e 6 cm", "Mínimo 8 cm", "Depende do peso da vítima"], correct: 1 },
    { level: "Média", cat: "Avaliação", q: "Como verificar a responsividade em um lactente (bebê)?", opts: ["Sacudir o tronco", "Chamar pelo nome alto", "Bater na planta dos pés", "Pressionar o esterno"], correct: 2 },
    { level: "Média", cat: "Equipamento", q: "Assim que o DEA chega ao local, qual o primeiro passo?", opts: ["Colar as pás", "Ligar o aparelho", "Pedir para parar a RCP", "Checar a bateria"], correct: 1 },
    { level: "Média", cat: "OVACE", q: "Se uma vítima de engasgo tosse ruidosamente, você deve:", opts: ["Fazer manobra de Heimlich", "Dar tapas nas costas", "Estimular a tosse", "Oferecer água"], correct: 2 },
    { level: "Média", cat: "Leigos", q: "O termo 'Hands-Only' refere-se a:", opts: ["RCP sem ajuda de aparelhos", "RCP focada apenas em compressões", "Uso exclusivo do DEA", "Manobra de desengasgo manual"], correct: 1 },
    { level: "Difícil", cat: "Fisiologia", q: "Após quantos minutos sem oxigênio a morte biológica geralmente se instala?", opts: ["2 minutos", "4 minutos", "10 minutos", "30 minutos"], correct: 2 },
    { level: "Difícil", cat: "OVACE", q: "Qual a sequência da manobra para desengasgo de lactentes?", opts: ["Apenas Heimlich", "5 tapas no dorso + 5 compressões torácicas", "10 compressões abdominais", "Sacudir o bebê pelas pernas"], correct: 1 },
    { level: "Difícil", cat: "Técnica", q: "Por que deve-se trocar o compressor a cada 2 minutos?", opts: ["Para o colega aprender", "Para evitar queda na qualidade por fadiga", "Regra de protocolo sem base física", "Para checar o pulso"], correct: 1 },
    { level: "Difícil", cat: "OVACE", q: "Vítima de engasgo total perde a consciência. Próximo passo?", opts: ["Tentar Heimlich no chão", "Abrir a boca e varrer com o dedo", "Deitar a vítima e iniciar 30 compressões", "Esperar o SAMU chegar"], correct: 2 },
    { level: "Difícil", cat: "Gestantes", q: "Onde aplicar as compressões de Heimlich em uma gestante avançada?", opts: ["No abdômen superior", "No centro do tórax (esterno)", "Nas costas", "Na pelve"], correct: 1 },
    { level: "Difícil", cat: "Protocolo", q: "Na Cadeia de Sobrevivência Intra-hospitalar, o primeiro elo é:", opts: ["RCP precoce", "Desfibrilação", "Vigilância e Prevenção", "Cuidados Pós-PCR"], correct: 2 },
    { level: "Difícil", cat: "Fisiologia", q: "Qual a importância do recuo total do tórax entre compressões?", opts: ["Descanso do socorrista", "Permitir o reenchimento das câmaras cardíacas", "Prevenir quebra de costelas", "Aumentar a ventilação"], correct: 1 },
    { level: "Difícil", cat: "Avaliação", q: "No suporte profissional, o tempo máximo para checar pulso/respiração é:", opts: ["5 segundos", "10 segundos", "20 segundos", "1 minuto"], correct: 1 }
];

const flashcards = [
    { front: "Ritmo RCP Adulto", back: "100-120 BPM", sub: "Ritmo de 'Stayin Alive'", cat: "Técnica" },
    { front: "C : V Adulto", back: "30 : 2", sub: "30 Compressões : 2 Sopros", cat: "Protocolo" },
    { front: "Profundidade Adulto", back: "5 - 6 cm", sub: "Recuo total necessário", cat: "Técnica" },
    { front: "Manobra Bebê", back: "5 Tapas + 5 Comp.", sub: "Cabeça mais baixa que o tronco", cat: "OVACE" },
    { front: "Morte Biológica", back: "10 Minutos", sub: "Estado de irreversibilidade", cat: "Fisiologia" },
    { front: "Testar Resposta", back: "Chamar / Bater", sub: "Ombros por 10s", cat: "Avaliação" },
    { front: "Sigla DEA", back: "Desfibrilador Externo Automático", sub: "Equipamento eletrônico portátil", cat: "Equipamento" },
    { front: "Troca de Socorrista", back: "A cada 2 Minutos", sub: "Evita exaustão e queda de qualidade", cat: "Técnica" },
    { front: "Local Compressão", back: "Centro do Peito", sub: "Metade inferior do osso esterno", cat: "Técnica" },
    { front: "Profundidade Criança", back: "Cerca de 5 cm", sub: "Ou 1/3 do diâmetro do tórax", cat: "Técnica" },
    { front: "Profundidade Lactente", back: "Cerca de 4 cm", sub: "Ou 1/3 do diâmetro do tórax", cat: "Técnica" },
    { front: "Sinal de Asfixia", back: "Mãos no Pescoço", sub: "Sinal universal de engasgo total", cat: "OVACE" },
    { front: "C : V Criança (2 Soc.)", back: "15 : 2", sub: "15 Compressões : 2 Sopros", cat: "Protocolo" },
    { front: "Número do SAMU", back: "192", sub: "Serviço de Urgência no Brasil", cat: "Acionamento" },
    { front: "Recuo do Tórax", back: "Permitir Enchimento", sub: "O sangue precisa retornar ao coração", cat: "Mecânica" }
];

const protocolsData = {
    extra: [
        { id: 1, title: "Acionamento", color: "bg-blue-600", steps: ["Identificação: Toque nos ombros e chame alto por 10s.", "Reconhecimento: Vítima não responde e não respira.", "Acionamento 192: Informe o endereço exato e estado de PCR.", "DEA: Peça explicitamente que alguém traga o desfibrilador."], rationale: "A ativação precoce do serviço médico reduz drasticamente o tempo para o primeiro choque.", practice: { pro: "Ao ligar para o 192, coloque o celular no viva-voz e mantenha-o ao lado da vítima. Diga claramente: 'Estou na [Rua X], com um adulto em Parada Cardíaca, já iniciei as compressões e preciso de um DEA'. Não desligue até o atendente autorizar.", nonpro: "Ligue para o 192 ou peça para alguém ligar. Diga onde você está e que a pessoa não está acordando nem respirando. Siga as instruções que o atendente der pelo telefone." } },
        { id: 2, title: "RCP Precoce", color: "bg-blue-600", steps: ["Posição: Joelhos ao lado da vítima, braços retos.", "Técnica: Centro do esterno (peito). Profundidade de 5-6 cm.", "Frequência: 100-120 batidas por minuto constante.", "Recuo: Permitir reexpansão total do tórax a cada ciclo."], rationale: "Compressões de alta qualidade preservam a circulação residual e mantêm o cérebro viável.", practice: { pro: "Entrelace os dedos e use a 'raiz' da mão (região hipotenar) no centro do peito. Mantenha seus ombros diretamente sobre as mãos da vítima. Não dobre os cotovelos; use o peso do seu tronco para empurrar.", nonpro: "Coloque uma mão sobre a outra no meio do peito da pessoa e empurre com força e rapidez. Tente seguir o ritmo da música 'Stayin' Alive'." } },
        { id: 3, title: "Desfibrilação", color: "bg-blue-600", steps: ["Ligar DEA imediatamente assim que chegar.", "Seguir instruções de voz: Cole as pás no tórax nu.", "Gritar 'Afastem-se' durante a análise e o disparo.", "Retomar RCP logo após o choque sem parar para checar pulso."], rationale: "O choque precoce em ritmos chocáveis (FV/TV) é o único tratamento definitivo.", practice: { pro: "Se houver suor, seque o tórax. Se houver pelos excessivos, use o barbeador ou a própria pá para depilar. Garanta que ninguém toca na vítima durante a análise do ritmo.", nonpro: "Ligue o aparelho e faça exatamente o que ele mandar por voz. Ele vai te guiar em cada passo. Não tenha medo de dar o choque se o aparelho mandar, ele é seguro." } },
        { id: 4, title: "Suporte Avançado", color: "bg-blue-600", steps: ["Relatar tempo de PCR e número de choques aplicados.", "Manejo profissional: Intubação e acesso venoso pela equipe.", "Continuidade: Não interromper manobras até transferência completa."], rationale: "A estabilização avançada otimiza o fluxo e trata as causas reversíveis específicas.", practice: { pro: "Informe rapidamente à equipe: tempo estimado de parada, ciclos realizados e choques entregues. Continue a RCP até que eles assumam explicitamente.", nonpro: "Quando a ambulância chegar, continue ajudando até os paramédicos pedirem para você se afastar. Conte a eles o que você viu acontecer." } },
        { id: 5, title: "Pós-PCR", color: "bg-blue-600", steps: ["UTI: Monitorar estabilidade hemodinâmica sistêmica.", "Neuroproteção: Iniciar controle direcionado de temperatura.", "Causa Base: Tratar a patologia original (Ex: Infarto)."], rationale: "Fase crítica para prevenir a síndrome pós-PCR e falência multiorgânica.", practice: { pro: "Mantenha o monitoramento rigoroso. Se houver retorno da circulação, coloque em posição lateral se não houver trauma. Prepare para o transporte assistido.", nonpro: "Se a pessoa voltar a respirar, vire-a de lado com cuidado até a ajuda chegar para que ela não se engasgue." } },
        { id: 6, title: "Recuperação", color: "bg-blue-800", steps: ["Reabilitação motora e avaliação cognitiva precoce.", "Acompanhamento psicológico para o sobrevivente e família.", "Plano de alta multidisciplinar com orientações preventivas."], rationale: "A sobrevivência não termina na alta; o foco final é a funcionalidade social.", practice: { pro: "Inicie avaliação de danos neurológicos e coordene com a fisioterapia. Realize o debriefing com a equipe que participou do socorro.", nonpro: "Depois que tudo passar, procure conversar com alguém sobre como você se sente. Salvar uma vida é emocionante, mas também pode ser estressante." } }
    ],
    intra: [
        { id: 1, title: "Vigilância", color: "bg-emerald-600", steps: ["Monitorar sinais vitais e tendências de deterioração clínica.", "Aplicação de escores de alerta (NEWS/MEWS) sistemáticos.", "Acionamento preventivo do Time de Resposta Rápida (TRR)."], rationale: "Detectar o choque ou hipóxia ANTES da parada hospitalar reduz mortalidade.", practice: { pro: "Utilize escores de alerta (como o NEWS) em cada rodada de sinais vitais para detectar riscos precocemente. Se a pontuação subir, não espere a parada; chame o Time de Resposta Rápida.", nonpro: "Ao notar um paciente ou visitante muito ofegante, com a pele arroxeada ou que parou de responder, avise a equipe de enfermagem do posto mais próximo imediatamente." } },
        { id: 2, title: "Acionamento", color: "bg-emerald-600", steps: ["Socorro imediato: Grite por ajuda ou use o botão de Código Azul.", "Equipe: Indicar quem traz o carrinho de emergência/DEA.", "Início: O primeiro socorrista inicia RCP básica no leito."], rationale: "Resposta organizada hospitalar em < 2 min preserva funções orgânicas.", practice: { pro: "Grite 'Código Azul no Leito X' e acione o botão de emergência na parede. Designe funções: 'Você, traga o carrinho; você, ligue o monitor'. Inicie compressões no leito imediatamente.", nonpro: "Pressione o botão de campainha na cabeceira do paciente ou corra ao corredor gritando por ajuda da enfermagem informando o número do quarto. Não tente mover o paciente sozinho." } },
        { id: 3, title: "RCP Precoce", color: "bg-emerald-600", steps: ["Prancha rígida: Insira sob o tórax para evitar perda de energia no colchão.", "Ciclo 30:2: Utilizar ambu com reservatório conectado a O2 100%.", "Fadiga: Trocar compressor a cada 2 min rigorosamente."], rationale: "Técnica profissional maximiza oxigenação e retorno da circulação espontânea.", practice: { pro: "Instale a prancha rígida sob o tórax do paciente. Inicie ciclos de 30 compressões para 2 ventilações com Ambu conectado a O2. Troque o compressor a cada 2 minutos para evitar queda na qualidade.", nonpro: "Se você souber fazer a massagem, inicie apenas as compressões no peito enquanto a equipe prepara os equipamentos. Caso contrário, ajude a afastar poltronas e mesas para abrir espaço para os médicos." } },
        { id: 4, title: "Desfibrilação", color: "bg-emerald-600", steps: ["Análise: Utilizar monitor manual para identificar ritmo em 10s.", "Choque: FV/TVSP carregar 200J (Bifásico) e afastar O2.", "Fluxo: Retomar compressões imediatamente após o disparo."], rationale: "Minimizar o tempo porta-choque hospitalar é o maior indicador de qualidade.", practice: { pro: "Utilize o desfibrilador manual e cheque o ritmo em no máximo 10 segundos. Afaste o fluxo de oxigênio durante o disparo. Após o choque, retome as compressões sem checar pulso.", nonpro: "Ajude trazendo o DEA do corredor se solicitado. No momento do choque, garanta que ninguém (nem você) encoste na cama ou em grades metálicas do leito." } },
        { id: 5, title: "Pós-PCR", color: "bg-emerald-600", steps: ["H's e T's: Tratar Hipovolemia, Toxinas, Hipóxia, etc.", "Monitoração invasiva: PAM > 65mmHg e ETCO2 contínuo.", "Cuidados Críticos: Estabilização em ambiente de UTI monitorado."], rationale: "Fase para estabilizar sistemas e prevenir a recorrência da parada.", practice: { pro: "Estabilize o paciente, monitore a pressão arterial invasiva e prepare a transferência para a UTI. Verifique a patency do tubo e acesso venoso.", nonpro: "Ajude a liberar os corredores e elevadores para a maca passar rápido. Ofereça um copo d'água ou uma cadeira para os familiares que estiverem nervosos ou chorando no local." } },
        { id: 6, title: "Recuperação", color: "bg-emerald-800", steps: ["Avaliação neurofuncional e plano de reabilitação fisioterápica.", "Treinamento de cuidadores sobre cuidados pós-evento.", "Suporte multidisciplinar para reintegração social."], rationale: "Garante reabilitação segura e evita reinternações por complicações evitáveis.", practice: { pro: "Organize o plano multidisciplinar (fisioterapia, fonoaudiologia). Realize o debriefing com a equipe assistencial para identificar pontos de melhoria no atendimento.", nonpro: "Auxilie na organização e limpeza do quarto pós-evento. Garanta que o ambiente permaneça calmo e silencioso para favorecer o descanso e a recuperação do paciente." } }
    ]
};

// UI ACTIONS
window.showView = (v) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`view-${v}`);
    if(target) target.classList.add('active');
    if (v !== 'metronomo' && metroState.isRunning) window.stopMetronome();
    window.scrollTo(0,0);
};

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('active');
};

window.switchChain = (t) => {
    const display = document.getElementById('chain-display');
    if(!display) return;
    display.innerHTML = protocolsData[t].map((e, i) => `<div onclick="window.showEloDetail('${t}', ${i})" class="cursor-pointer p-4 rounded-2xl ${e.color} text-white shadow-md hover:scale-105 transition-all text-center"><div class="text-[8px] font-black uppercase opacity-60 mb-1">Elo 0${e.id}</div><div class="font-black text-[9px] uppercase leading-tight">${e.title}</div></div>`).join('');
    const be = document.getElementById('btn-extra');
    const bi = document.getElementById('btn-intra');
    if(be) be.className = t === 'extra' ? 'px-8 py-3 rounded-xl font-bold bg-blue-700 text-white shadow-lg' : 'px-8 py-3 rounded-xl font-bold text-slate-500 border border-slate-200';
    if(bi) bi.className = t === 'intra' ? 'px-8 py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg' : 'px-8 py-3 rounded-xl font-bold text-slate-500 border border-slate-200';
    window.showEloDetail(t, 0);
};

window.showEloDetail = (t, i) => {
    const elo = protocolsData[t][i];
    const content = document.getElementById('detail-content');
    if(!content) return;
    const isIntra = t === 'intra';
    content.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-12 items-start transition-all animate-in slide-in-from-left">
            <div class="lg:w-1/2 text-left">
                <div class="w-12 h-12 ${elo.color} rounded-xl mb-4 flex items-center justify-center text-white font-black">0${elo.id}</div>
                <h3 class="text-3xl font-black ${isIntra ? 'text-emerald-900 dark:text-emerald-500' : 'text-blue-900 dark:text-blue-400'} mb-4 uppercase italic">${elo.title}</h3>
                <div class="space-y-4 mb-6">
                    ${elo.steps.map((s, idx) => `<div class="step-item font-medium text-slate-700 dark:text-slate-300"><span class="step-number text-xs font-black ${isIntra ? '!bg-emerald-600' : '!bg-blue-700'}">${idx+1}</span>${s}</div>`).join('')}
                </div>
                <div class="${isIntra ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-600 text-emerald-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-800'} p-6 rounded-2xl border-l-4 italic text-sm">
                    ${elo.rationale}
                </div>
            </div>
            <div class="lg:w-1/2 w-full h-64 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] illustration-grid border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 italic">
                Área de Visualização Técnica
            </div>
        </div>
        <div class="mt-8 space-y-6">
            <div class="flex items-center space-x-3 mb-2">
                <div class="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center text-white">❤️</div>
                <h4 class="text-xl font-black text-blue-900 dark:text-blue-400 uppercase italic tracking-tight">Execução no Mundo Real</h4>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
                <div class="practice-card p-8 rounded-[2.5rem] border-l-[10px] border-l-blue-700 shadow-sm flex flex-col">
                    <span class="text-[10px] font-black uppercase bg-blue-100 text-blue-700 px-3 py-1 rounded-full w-fit mb-4">Profissional da Saúde</span>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic font-medium">${elo.practice.pro}</p>
                </div>
                <div class="practice-card p-8 rounded-[2.5rem] border-l-[10px] border-l-emerald-600 shadow-sm flex flex-col">
                    <span class="text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full w-fit mb-4">Não é da Saúde</span>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic font-medium">${elo.practice.nonpro}</p>
                </div>
            </div>
        </div>`;
};

// FLASHCARDS GRID
const flashGrid = document.getElementById('flashcards-grid');
if(flashGrid) flashGrid.innerHTML = flashcards.map(f => `<div class="flashcard-container h-64 perspective" onclick="this.classList.toggle('flipped')"><div class="flashcard-inner"><div class="flashcard-front bg-white dark:bg-slate-900 border border-slate-200 shadow-md"><span class="text-blue-600 font-black mb-4 uppercase text-[10px] tracking-widest">${f.cat}</span><h4 class="text-xl font-bold text-center">${f.front}</h4></div><div class="flashcard-back bg-blue-700 text-white shadow-xl"><h4 class="text-3xl font-black mb-2">${f.back}</h4><p class="text-xs uppercase opacity-80">${f.sub}</p></div></div></div>`).join('');

// INICIALIZAÇÃO PADRÃO
window.switchChain('extra');

// --- LÓGICA DO QUIZ (SIMULADOR) ---
window.startQuiz = () => {
    currentQIndex = 0; 
    sessionResults = [];
    const intro = document.getElementById('quiz-intro');
    const ui = document.getElementById('quiz-ui');
    if(intro) intro.classList.add('hidden');
    if(ui) ui.classList.remove('hidden');
    window.renderQuestion();
};

window.renderQuestion = () => {
    const q = quizQuestions[currentQIndex];
    const qCount = document.getElementById('q-count');
    const qProgress = document.getElementById('q-progress');
    const content = document.getElementById('quiz-content');

    if(qCount) qCount.innerText = `${currentQIndex + 1} / ${quizQuestions.length}`;
    if(qProgress) qProgress.style.width = `${((currentQIndex + 1) / quizQuestions.length) * 100}%`;
    
    if(content) {
        content.innerHTML = `
            <div class="mb-6 flex items-center justify-between">
                <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase">${q.cat}</span>
            </div>
            <h3 class="text-2xl font-black mb-10 leading-tight text-blue-950 dark:text-blue-400">${q.q}</h3>
            <div class="space-y-4">
                ${q.opts.map((o, i) => `
                    <button onclick="window.submitAnswer(${i})" class="quiz-option w-full text-left p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50 flex items-center group transition-all">
                        <span class="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mr-6 font-black group-hover:bg-blue-600 group-hover:text-white">${i+1}</span>
                        <span class="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs">${o}</span>
                    </button>
                `).join('')}
            </div>`;
    }
};

window.submitAnswer = (i) => {
    const q = quizQuestions[currentQIndex];
    sessionResults.push({ category: q.cat, correct: i === q.correct, questionIndex: currentQIndex });
    
    if (currentQIndex < quizQuestions.length - 1) {
        currentQIndex++; 
        window.renderQuestion();
    } else {
        const score = Math.round((sessionResults.filter(r => r.correct).length / quizQuestions.length) * 100);
        const ui = document.getElementById('quiz-ui');
        const intro = document.getElementById('quiz-intro');
        if(ui) ui.classList.add('hidden');
        if(intro) {
            intro.classList.remove('hidden');
            const feedbackList = window.getFeedbackHTML(sessionResults, quizQuestions);
            intro.innerHTML = `
                <div class="p-12 bg-blue-50 dark:bg-slate-800/50 rounded-[3rem] border-2 border-blue-100 dark:border-slate-800 text-center">
                    <h3 class="text-4xl font-black mb-2 text-blue-900 dark:text-blue-400 italic">Ciclo Concluído</h3>
                    <div class="text-8xl font-black text-blue-600 dark:text-blue-500 mb-8">${score}%</div>
                    <button onclick="window.startQuiz()" class="bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl">Refazer Simulado</button>
                    ${feedbackList}
                </div>`;
        }
    }
};

// --- LÓGICA DA AVALIAÇÃO FINAL ---
window.startFinalExam = () => {
    currentFIndex = 0; 
    finalExamResults = [];
    const intro = document.getElementById('final-intro');
    const ui = document.getElementById('final-ui');
    if(intro) intro.classList.add('hidden');
    if(ui) ui.classList.remove('hidden');
    window.renderFinalQuestion();
};

window.renderFinalQuestion = () => {
    const q = finalExamQuestions[currentFIndex];
    const fCount = document.getElementById('f-count');
    const fProgress = document.getElementById('f-progress');
    const content = document.getElementById('final-content');

    if(fCount) fCount.innerText = `${currentFIndex + 1} / ${finalExamQuestions.length}`;
    if(fProgress) fProgress.style.width = `${((currentFIndex + 1) / finalExamQuestions.length) * 100}%`;

    if(content) {
        content.innerHTML = `
            <h3 class="text-2xl font-black mb-10 leading-tight text-slate-900 dark:text-white">${q.q}</h3>
            <div class="space-y-4">
                ${q.opts.map((o, i) => `
                    <button onclick="window.submitFinalAnswer(${i})" class="quiz-option w-full text-left p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:bg-rose-50 flex items-center group transition-all">
                        <span class="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mr-6 font-black group-hover:bg-rose-700 group-hover:text-white">${i+1}</span>
                        <span class="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs">${o}</span>
                    </button>
                `).join('')}
            </div>`;
    }
};

window.submitFinalAnswer = (i) => {
    const q = finalExamQuestions[currentFIndex];
    finalExamResults.push({ category: q.cat, correct: i === q.correct, questionIndex: currentFIndex });
    
    if (currentFIndex < finalExamQuestions.length - 1) {
        currentFIndex++; 
        window.renderFinalQuestion();
    } else {
        const score = Math.round((finalExamResults.filter(r => r.correct).length / finalExamQuestions.length) * 100);
        const ui = document.getElementById('final-ui');
        const intro = document.getElementById('final-intro');
        if(ui) ui.classList.add('hidden');
        if(intro) {
            intro.classList.remove('hidden');
            intro.innerHTML = `
                <div class="p-12 bg-rose-50 dark:bg-rose-900/20 rounded-[3rem] border-2 border-rose-100 dark:border-slate-800 text-center">
                    <h3 class="text-4xl font-black mb-2 text-rose-900 dark:text-blue-400 italic">Resultado Final</h3>
                    <div class="text-8xl font-black text-rose-700 dark:text-rose-600 mb-4">${score}%</div>
                    <button onclick="window.startFinalExam()" class="bg-rose-700 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-xl">Tentar Novamente</button>
                </div>`;
        }
    }
};

window.getFeedbackHTML = (results, questions) => {
    const incorrects = results.filter(r => !r.correct);
    if (incorrects.length === 0) return `<p class="text-emerald-600 font-bold mt-8">Desempenho Perfeito!</p>`;
    
    return `
        <div class="mt-12 text-left">
            <h4 class="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-6 text-center italic">Revisão Técnica</h4>
            <div class="space-y-4">
                ${incorrects.map(r => {
                    const q = questions[r.questionIndex];
                    return `
                        <div class="p-6 bg-white dark:bg-slate-900 border border-rose-100 rounded-3xl">
                            <p class="text-sm font-black mb-2 text-slate-800 dark:text-slate-200">${q.q}</p>
                            <p class="text-xs text-emerald-600 font-bold italic">Correção: ${q.opts[q.correct]}</p>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
};

// Abre a janela de login
window.openAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // Garante a centralização
    }
};

// Fecha a janela de login
window.closeAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// Alterna entre a tela de "Entrar" e "Criar Conta"
window.toggleAuthView = (view) => {
    const loginView = document.getElementById('auth-login-view');
    const registerView = document.getElementById('auth-register-view');
    if (loginView && registerView) {
        if (view === 'login') {
            loginView.classList.remove('hidden');
            registerView.classList.add('hidden');
        } else {
            loginView.classList.add('hidden');
            registerView.classList.remove('hidden');
        }
    }
};









