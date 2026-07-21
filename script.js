const appId = 'lifesupport-pro-v1';
let currentuser = null;
let attempts = [];
let currentQIndex = 0;
let currentFIndex = 0; 
let sessionResults = [];
let finalExamResults = [];
let learningChartInstance = null;
let currentPreIndex = 0;
let preTestResults = [];

// LOGICA DO SUPABASE (Sessão Global)
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica Sessão
    const session = await window.getSession();
    if(session && session.user) {
        updateSidebarForuser(session.user);
        if(window.closeAuthModal) window.closeAuthModal();
    }
    
    // 2. Sempre verifica a fase do estudo para exibir o overlay correto (TCLE, Perfil, etc)
    window.checkStudyPhase();

    // 3. Lógica Entrar
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-login-submit');
            btn.textContent = "Carregando...";
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            
            if(error) {
                alert(`Erro: ${error.message}`);
                btn.textContent = "Entrar";
            } else {
                alert("Autenticado com sucesso!");
                location.reload();
            }
        });
    }

    // 4. Lógica Cadastro
    const regForm = document.getElementById('register-form');
    if(regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-reg-submit');
            btn.textContent = "Carregando...";
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            
            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
            
            if(error) {
                alert(`Erro: ${error.message}`);
                btn.textContent = "Registrar";
            } else {
                alert('CONTA CRIADA COM SUCESSO!\n\nUm link de confirmação poderá ter sido enviado para o seu e-mail (caso a validação de segurança esteja ativa no seu banco de dados). \n\nAgora, por favor, clique em OK e faça o seu login com a conta recém criada para prosseguir!');
                btn.textContent = "Registrar";
                if(window.toggleAuthView) window.toggleAuthView('login');
            }
        });
    }

    // Lógica para o TCLE agora é de aceite direto para evitar bloqueios
});


function updateSidebarForuser(user) {
    const loginBtn = document.getElementById('sidebar-login-btn');
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    
    if (loginBtn && logoutBtn) {
        loginBtn.textContent = user.email.split('@')[0]; // Mostra nickname
        loginBtn.classList.remove('bg-blue-700', 'hover:bg-blue-800', 'text-white');
        loginBtn.classList.add('bg-slate-100', 'text-blue-700', 'dark:bg-slate-800', 'dark:text-blue-400');
        loginBtn.onclick = null;
        
        logoutBtn.classList.remove('hidden');
    }
}

// Coloque esta função aqui para evitar erros de histórico vazio
window.renderDashboard = async () => {
    console.log("Renderizando Dashboard...");
    const session = await window.checkSession();
    let history = [];
    
    // Obter dados: Nuvem ou Local?
    if (session && session.user) {
        document.getElementById('auth-status-text').textContent = "Sincronizado na Nuvem";
        document.getElementById('auth-status-text').classList.replace('text-blue-600', 'text-emerald-600');
        document.getElementById('auth-status-text').classList.replace('bg-blue-50', 'bg-emerald-50');
        
        const { data, error } = await window.supabaseClient
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', session.user.id)
            .order('date', { ascending: true });
        
        if (!error && data) history = data;
    } else {
        document.getElementById('auth-status-text').textContent = "Modo Off-line (Local)";
        history = JSON.parse(localStorage.getItem('bls_quiz_attempts')) || [];
    }

    const placeholder = document.getElementById('stats-placeholder');
    const container = document.getElementById('stats-container');

    if (!history || history.length === 0) {
        if(placeholder) placeholder.classList.remove('hidden');
        if(container) container.classList.add('hidden');
        return;
    }

    if(placeholder) placeholder.classList.add('hidden');
    if(container) container.classList.remove('hidden');

    // Cálculos
    const validAttempts = history.filter(a => a.percent !== undefined); // Evita NaN
    const avgScore = validAttempts.length ? Math.round(validAttempts.reduce((acc, a) => acc + a.percent, 0) / validAttempts.length) : 0;
    const bestScore = validAttempts.length ? Math.max(...validAttempts.map(a => a.percent)) : 0;
    const latestScore = validAttempts.length ? validAttempts[validAttempts.length - 1].percent : 0;

    document.getElementById('total-attempts').innerText = validAttempts.length;
    document.getElementById('avg-score').innerText = avgScore + '%';
    document.getElementById('best-score').innerText = bestScore + '%';
    document.getElementById('latest-score').innerText = latestScore + '%';

    // Gráfico Chart.js
    const ctxEls = document.getElementById('learningChart');
    if(ctxEls) {
        const ctx = ctxEls.getContext('2d');
        if (learningChartInstance) {
            learningChartInstance.destroy();
        }

        learningChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validAttempts.map((_, i) => 'Teste ' + (i + 1)),
                datasets: [{
                    label: 'Score Geral (%)',
                    data: validAttempts.map(a => a.percent),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#2563eb',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Lista de Histórico
    const historyList = document.getElementById('history-list');
    if(historyList) {
        historyList.innerHTML = validAttempts.slice().reverse().map((a, i) => {
            const d = new Date(a.date);
            const formatD = d.toLocaleDateString();
            const typeTranslate = a.type === 'simulado' ? 'Simulação Prática' : 'Avaliação Final';
            const isPass = a.percent >= 80;
            return `
                <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div>
                        <p class="font-bold text-slate-800 dark:text-slate-200 text-sm">${typeTranslate}</p>
                        <p class="text-[10px] text-slate-500 uppercase">${formatD}</p>
                    </div>
                    <div class="font-black ${isPass ? 'text-emerald-600' : 'text-rose-600'} text-lg">${a.percent}%</div>
                </div>
            `;
        }).join('');
    }
};

// ACORDEÃO
window.toggleAccordion = (button) => {
    const item = button.parentElement;
    const isactive = item.classList.contains('active');
    document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
    if (!isactive) {
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
    
    // 4. Salva não navegador para não perder ao recarregar
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

// OS DADOS (quizQuestions, finalExamQuestions, flashcards) 
// FORAM MOVIDOS PARA O ARQUIVO tcc_questions.js PARA FACILITAR SUA EDIÇÃO MANUAL.


const protocolsData = {
    extra: [
        { id: 1, title: "Acionamento", color: "bg-blue-600", steps: ["Identificação: Toque nos ombros e chame alto por 10s.", "Reconhecimento: Vítima não responde e não respira.", "Acionamento 192: Informe o endereço exato e estado de PCR.", "DEA: Peça explicitamente que alguém traga o desfibrilador."], rationale: "A ativação precoce do serviço médico reduz drasticamente o tempo para o primeiro choque.", practice: { pro: "Ao ligar para o 192, coloque o celular no viva-voz e mantenha-o ao lado da vítima. Diga claramente: 'Estou na [Rua X], com um adulto em Parada Cardíaca, já iniciei as compressões e preciso de um DEA'. Não desligue até o atendente autorizar.", nonpro: "Ligue para o 192 ou peça para alguém ligar. Diga onde você está e que a pessoa não está acordando nem respirando. Siga as instruções que o atendente der pelo telefone." } },
        { id: 2, title: "RCP Precoce", color: "bg-blue-600", steps: ["Posição: Joelhos ao lado da vítima, braços retos.", "Técnica: Centro do esterno (peito). Profundidade de 5-6 cm.", "Frequência: 100-120 batidas por minuto constante.", "Recuo: Permitir reexpansão total do tórax a cada ciclo."], rationale: "Compressões de alta qualidade preservam a circulação residual e mantêm o cérebro viável.", practice: { pro: "Entrelace os dedos e use a 'raiz' da mão (região hipotenar) no centro do peito. Mantenha seus ombros diretamente sobre as mãos da vítima. Não dobre os cotovelos; use o peso do seu tronco para empurrar.", nonpro: "Coloque uma mão sobre a outra no meio do peito da pessoa e empurre com força e rapidez. Tente seguir o ritmo da música 'Stayin' Alive'." } },
        { id: 3, title: "Desfibrilação", color: "bg-blue-600", steps: ["Ligar DEA imediatamente assim que chegar.", "Seguir instruções de voz: Cole as pás no tórax nu.", "Gritar 'Afastem-se' durante a análise e o disparo.", "Retomar RCP logo após o choque sem parar para checar pulso."], rationale: "O choque precoce em ritmos chocáveis (FV/TV) é o único tratamento definitivo.", practice: { pro: "Se houver suor, seque o tórax. Se houver pelos excessivos, use o barbeador ou a própria pá para depilar. Garanta que ninguém toca na vítima durante a análise do ritmo.", nonpro: "Ligue o aparelho e faça exatamente o que ele mandar por voz. Ele vai te guiar em cada passo. Não tenha medo de dar o choque se o aparelho mandar, ele é seguro." } },
        { id: 4, title: "Suporte Avançado", color: "bg-blue-600", steps: ["Relatar tempo de PCR e número de choques aplicados.", "Manejo profissional: Intubação e acesso venoso pela equipe.", "Continuidade: Não interromper manobras até transferência completa."], rationale: "A estabilização avançada otimiza o fluxo e trata as causas reversíveis específicas.", practice: { pro: "Informe rapidamente à equipe: tempo estimado de parada, ciclos realizados e choques entregues. Continue a RCP até que eles assumam explicitamente.", nonpro: "Quando a ambulância chegar, continue ajudando até os paramédicos pedirem para você se afastar. Conte a eles o que você viu acontecer." } },
        { id: 5, title: "Pós-PCR", color: "bg-blue-600", steps: ["UTI: Monitorar estabilidade hemodinâmica sistêmica.", "Neuroproteção: Iniciar controle direcionado de temperatura.", "Causa Base: Tratar a patologia original (Ex: Infarto)."], rationale: "Fase crítica para prevenir a síndrome pós-PCR e falência multiorgânica.", practice: { pro: "Mantenha o monitoramento rigoroso. Se houver retorno da circulação, coloque em posição lateral se não houver trauma. Prepare para o transporte assistido.", nonpro: "Se a pessoa voltar a respirar, vire-a de lado com cuidado até a ajuda chegar para que ela não se engasgue." } },
        { id: 6, title: "Recuperação", color: "bg-blue-800", steps: ["Reabilitação motora e Avaliação cognitiva precoce.", "Acompanhamento psicológico para o sobrevivente e família.", "Plano de alta multidisciplinar com orientações preventivas."], rationale: "A sobrevivência não termina na alta; o foco final é a funcionalidade social.", practice: { pro: "Inicie Avaliação de danos neurológicos e coordene com a fisioterapia. Realize o debriefing com a equipe que participou do socorro.", nonpro: "Depois que tudo passar, procure conversar com alguém sobre como você se sente. Salvar uma vida é emocionante, mas também pode ser estressante." } }
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

    // Fecha o menu lateral automaticamente ao navegar no celular
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        window.toggleSidebar();
    }
};

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('active');
};

window.switchChain = (t) => {
    // 1. Renderização para Desktop
    const display = document.getElementById('chain-display');
    if (display) {
        display.innerHTML = protocolsData[t].map((e, i) => `
            <div id="desktop-elo-node-${i}" onclick="window.showEloDetail('${t}', ${i})" class="desktop-elo-node cursor-pointer p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 shadow-sm hover:scale-105 transition-all text-center">
                <div class="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1">Elo 0${e.id}</div>
                <div class="font-black text-[9px] uppercase leading-tight">${e.title}</div>
            </div>
        `).join('');
    }

    // 2. Renderização para Mobile (Sanfona/Acordeão com Timeline Vertical)
    const displayMobile = document.getElementById('chain-display-mobile');
    if (displayMobile) {
        const isIntra = t === 'intra';
        displayMobile.innerHTML = protocolsData[t].map((elo, i) => `
            <div class="border border-slate-200 dark:border-slate-850 rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
                <!-- Cabeçalho do Elo -->
                <button onclick="window.toggleMobileElo(${i})" class="w-full flex items-center justify-between p-5 text-left focus:outline-none select-none">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl ${elo.color} text-white flex items-center justify-center font-black shadow-sm text-sm shrink-0">
                            0${elo.id}
                        </div>
                        <div>
                            <span class="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 block tracking-wider">Elo 0${elo.id}</span>
                            <span class="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200 uppercase">${elo.title}</span>
                        </div>
                    </div>
                    <!-- Ícone de seta -->
                    <svg id="mobile-arrow-${i}" class="w-5 h-5 text-slate-400 transition-transform duration-300 transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                
                <!-- Conteúdo Retrátil (Accordion) -->
                <div id="mobile-content-${i}" class="max-h-0 overflow-hidden transition-all duration-500 ease-in-out bg-slate-50/50 dark:bg-slate-900/10">
                    <div class="p-5 border-t border-slate-100 dark:border-slate-800/80 space-y-6">
                        <!-- Mídia (Vídeo/Foto/SVG) -->
                        <div class="w-full">
                            ${window.getEloMediaHTML(t, elo)}
                        </div>

                        <!-- Passos do Algoritmo -->
                        <div class="space-y-3">
                            <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Algoritmo Técnico</p>
                            ${elo.steps.map((s, idx) => `
                                <div class="step-item font-medium text-xs text-slate-700 dark:text-slate-300">
                                    <span class="step-number text-[10px] font-black ${isIntra ? '!bg-emerald-600' : '!bg-blue-700'}">${idx+1}</span>
                                    ${s}
                                </div>
                            `).join('')}
                        </div>

                        <!-- Justificativa (Rationale) -->
                        <div class="${isIntra ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-600 text-emerald-800 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-600 text-blue-800 dark:text-blue-400'} p-4 rounded-xl border-l-4 italic text-xs leading-relaxed">
                            ${elo.rationale}
                        </div>

                        <!-- Prática do Mundo Real -->
                        <div class="space-y-4 pt-2">
                            <div class="flex items-center space-x-2">
                                <span class="text-xs">❤️</span>
                                <h5 class="text-xs font-black uppercase text-slate-800 dark:text-slate-350 tracking-tight">Execução no Mundo Real</h5>
                            </div>
                            <div class="space-y-3">
                                <div class="practice-card p-5 rounded-2xl border-l-[6px] border-l-blue-600 shadow-sm">
                                    <span class="text-[8px] font-black uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full w-fit mb-2 block font-black">Profissional da Saúde</span>
                                    <p class="text-xs text-slate-650 dark:text-slate-300 leading-relaxed italic font-medium">${elo.practice.pro}</p>
                                </div>
                                <div class="practice-card p-5 rounded-2xl border-l-[6px] border-l-emerald-600 shadow-sm">
                                    <span class="text-[8px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full w-fit mb-2 block font-black">Não é da Saúde</span>
                                    <p class="text-xs text-slate-650 dark:text-slate-300 leading-relaxed italic font-medium">${elo.practice.nonpro}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    const be = document.getElementById('btn-extra');
    const bi = document.getElementById('btn-intra');
    if(be) be.className = t === 'extra' ? 'px-8 py-3 rounded-xl font-bold bg-blue-700 text-white shadow-lg' : 'px-8 py-3 rounded-xl font-bold text-slate-500 border border-slate-200 dark:border-slate-800';
    if(bi) bi.className = t === 'intra' ? 'px-8 py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg' : 'px-8 py-3 rounded-xl font-bold text-slate-500 border border-slate-200 dark:border-slate-800';
    
    // Inicializa a exibição de detalhes no desktop e mobile
    window.showEloDetail(t, 0);

    // No mobile, expande o primeiro Elo por padrão
    setTimeout(() => {
        window.toggleMobileElo(0);
    }, 100);

    // Update Flow navigation Destination
    const btnNextTeoria = document.getElementById('btn-next-teoria');
    const labelNextTeoria = document.getElementById('label-next-teoria');
    const iconNextTeoria = document.getElementById('icon-next-teoria');
    if (btnNextTeoria && labelNextTeoria && iconNextTeoria) {
        if (t === 'extra') {
            btnNextTeoria.setAttribute('onclick', "window.switchChain('intra'); window.scrollTo(0,0);");
            btnNextTeoria.className = "group flex items-center bg-emerald-50 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500 rounded-2xl p-4 transition-all hover:scale-105 shadow-sm hover:shadow-md";
            labelNextTeoria.className = "font-bold text-emerald-700 dark:text-emerald-400";
            labelNextTeoria.innerText = "Intra-hospitalar (PCRIH)";
            iconNextTeoria.className = "w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center group-hover:bg-emerald-700 transition-colors";
        } else {
            btnNextTeoria.setAttribute('onclick', "window.showView('diferencas');");
            btnNextTeoria.className = "group flex items-center bg-purple-50 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500 rounded-2xl p-4 transition-all hover:scale-105 shadow-sm hover:shadow-md";
            labelNextTeoria.className = "font-bold text-purple-700 dark:text-purple-400";
            labelNextTeoria.innerText = "Grupos específicos";
            iconNextTeoria.className = "w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center group-hover:bg-purple-700 transition-colors";
        }
    }
};

window.toggleMobileElo = (index) => {
    const totalElos = 6;
    for (let i = 0; i < totalElos; i++) {
        const content = document.getElementById(`mobile-content-${i}`);
        const arrow = document.getElementById(`mobile-arrow-${i}`);
        if (!content || !arrow) continue;

        if (i === index) {
            const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
            if (isOpen) {
                content.style.maxHeight = '0px';
                arrow.classList.remove('rotate-180');
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                arrow.classList.add('rotate-180');
                // Scroll suave após o efeito
                setTimeout(() => {
                    content.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            }
        } else {
            content.style.maxHeight = '0px';
            arrow.classList.remove('rotate-180');
        }
    }
};

window.showEloDetail = (t, i) => {
    const elo = protocolsData[t][i];
    const content = document.getElementById('detail-content');
    if(!content) return;
    const isIntra = t === 'intra';

    // Highlight active node in desktop chain display
    document.querySelectorAll('.desktop-elo-node').forEach((node, idx) => {
        if (idx === i) {
            node.className = `desktop-elo-node cursor-pointer p-4 rounded-2xl ${elo.color} text-white shadow-lg scale-105 border-transparent transition-all text-center`;
        } else {
            node.className = `desktop-elo-node cursor-pointer p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-350 shadow-sm hover:scale-105 transition-all text-center`;
        }
    });

    content.innerHTML = `
        <div class="flex flex-col lg:flex-row gap-12 items-center transition-all animate-in slide-in-from-left">
            <div class="lg:w-1/2 text-left w-full">
                <div class="w-12 h-12 ${elo.color} rounded-xl mb-4 flex items-center justify-center text-white font-black">0${elo.id}</div>
                <h3 class="text-3xl font-black ${isIntra ? 'text-emerald-900 dark:text-emerald-500' : 'text-blue-900 dark:text-blue-400'} mb-4 uppercase italic">${elo.title}</h3>
                <div class="space-y-4 mb-6">
                    ${elo.steps.map((s, idx) => `<div class="step-item font-medium text-slate-700 dark:text-slate-300"><span class="step-number text-xs font-black ${isIntra ? '!bg-emerald-600' : '!bg-blue-700'}">${idx+1}</span>${s}</div>`).join('')}
                </div>
                <div class="${isIntra ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-600 text-emerald-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-800'} p-6 rounded-2xl border-l-4 italic text-sm">
                    ${elo.rationale}
                </div>
            </div>
            <div class="lg:w-1/2 w-full flex-shrink-0">
                ${window.getEloMediaHTML(t, elo)}
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
                    <p class="text-sm text-slate-650 dark:text-slate-300 leading-relaxed italic font-medium">${elo.practice.pro}</p>
                </div>
                <div class="practice-card p-8 rounded-[2.5rem] border-l-[10px] border-l-emerald-600 shadow-sm flex flex-col">
                    <span class="text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full w-fit mb-4">Não é da Saúde</span>
                    <p class="text-sm text-slate-650 dark:text-slate-300 leading-relaxed italic font-medium">${elo.practice.nonpro}</p>
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
                    <label class="flex items-center gap-3 cursor-pointer p-4 bg-white dark:bg-slate-900 border rounded-xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-slate-200 dark:border-slate-700 transition-all font-bold has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:text-blue-700 dark:has-[:checked]:text-blue-400">
                        <input type="radio" name="simulado_q" value="${i}" class="w-5 h-5 text-blue-600">
                        <span class="text-slate-700 dark:text-slate-300">${o}</span>
                    </label>
                `).join('')}
            </div>
            <button onclick="window.submitAnswer()" class="w-full bg-blue-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-wide mt-6 transition-all shadow-xl">Avançar</button>
            <div class="mt-8 flex justify-between items-center w-full">
                ${currentQIndex > 0 ? `
                <button onclick="window.prevQuestion()" class="flex items-center space-x-2 text-slate-500 hover:text-blue-700 font-bold transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                    <span>Voltar Anterior</span>
                </button>
                ` : '<div></div>'}
                <button onclick="window.submitAnswer(-1)" class="flex items-center space-x-2 text-slate-400 hover:text-slate-600 font-bold transition-all">
                    <span>Pular Questão</span>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                </button>
            </div>
            `;
    }
};

window.prevQuestion = () => {
    if (currentQIndex > 0) {
        currentQIndex--;
        sessionResults.pop(); // remove a última tentativa armazenada para recadastrar
        window.renderQuestion();
    }
};
window.submitAnswer = (idxManual) => {
    const q = quizQuestions[currentQIndex];
    let i = idxManual;
    
    if (i === undefined) {
        const selected = document.querySelector('input[name="simulado_q"]:checked');
        if (!selected) {
            alert("Por favor, selecione uma opção ou clique em Pular.");
            return;
        }
        i = parseInt(selected.value);
    }

    const isCorrect = (i === -1) ? false : (i === q.correct);
    sessionResults.push({ category: q.cat, correct: isCorrect, QuestionIndex: currentQIndex, skipped: (i === -1) });
    
    if (currentQIndex < quizQuestions.length - 1) {
        currentQIndex++; 
        window.renderQuestion();
    } else {
        const correctCount = sessionResults.filter(r => r.correct).length;
        const score = Math.round((correctCount / quizQuestions.length) * 100);
        
        window.saveEvaluationResult('simulado', score, correctCount, quizQuestions.length);

        const ui = document.getElementById('quiz-ui');
        const intro = document.getElementById('quiz-intro');
        if(ui) ui.classList.add('hidden');
        if(intro) {
            intro.classList.remove('hidden');
            
            // Gerar feedback de erros
            let errorsHTML = '';
            const errors = sessionResults.filter(r => !r.correct);
            if (errors.length > 0) {
                errorsHTML = `
                    <div class="mt-10 text-left bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <h4 class="text-xl font-black text-rose-600 mb-6 uppercase italic tracking-tighter">Pontos de Melhoria</h4>
                        <div class="space-y-6">
                            ${errors.map(err => {
                                const qObj = quizQuestions[err.QuestionIndex];
                                return `
                                    <div class="pb-6 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                        <p class="font-bold text-slate-800 dark:text-slate-200 mb-2">${err.QuestionIndex + 1}. ${qObj.q}</p>
                                        <div class="flex items-center gap-2 text-sm text-emerald-600 font-bold">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                            <span>Correção: ${qObj.opts[qObj.correct]}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                errorsHTML = `
                    <div class="mt-10 p-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2.5rem] text-emerald-700 font-bold">
                        🎉 Desempenho Perfeito! Você dominou todos os tópicos deste ciclo.
                    </div>
                `;
            }

            intro.innerHTML = `
                <div class="p-12 bg-blue-50 dark:bg-slate-800/50 rounded-[4rem] border-2 border-blue-100 dark:border-slate-800 text-center">
                    <h3 class="text-4xl font-black mb-2 text-blue-900 dark:text-blue-400 italic uppercase tracking-tighter">Ciclo Concluído</h3>
                    <p class="text-slate-500 mb-8 font-medium">Confira seu desempenho técnico abaixo:</p>
                    <div class="text-9xl font-black text-blue-600 dark:text-blue-500 mb-10 tracking-tighter">${score}%</div>
                    <div class="flex flex-col sm:flex-row justify-center gap-4 mb-4">
                        <button onclick="window.startQuiz()" class="bg-blue-700 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-blue-800 transition-all">Refazer Simulado</button>
                        <button onclick="window.showView('avaliacao-final')" class="bg-white text-blue-700 border-2 border-blue-200 px-10 py-5 rounded-2xl font-black uppercase text-xs hover:bg-blue-50 transition-all">Ir para Avaliação Final</button>
                    </div>
                    ${errorsHTML}
                </div>`;
        }
    }
};

// --- LÓGICA DA AVALIAÇÃO FINAL ---
window.startFinalExam = () => {
    if(localStorage.getItem('study_final_test_done')) {
        alert("Você já concluiu o exame de certificação.");
        return;
    }
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
    const btnprev = document.getElementById('btn-final-prev');
    const btnNext = document.getElementById('btn-final-next');

    if(fCount) fCount.innerText = `${currentFIndex + 1} / ${finalExamQuestions.length}`;
    if(fProgress) fProgress.style.width = `${((currentFIndex + 1) / finalExamQuestions.length) * 100}%`;

    if(btnprev) {
        if(currentFIndex > 0) btnprev.classList.remove('hidden');
        else btnprev.classList.add('hidden');
    }
    
    if(btnNext) {
        if(currentFIndex === finalExamQuestions.length - 1) {
            btnNext.textContent = "Finalizar";
        } else {
            btnNext.textContent = "Avançar";
        }
    }

    const selectedAns = finalExamResults[currentFIndex] ? finalExamResults[currentFIndex].selected : null;

    if(content) {
        content.innerHTML = `
            <div class="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                <p class="font-bold text-slate-700 dark:text-slate-200 mb-4">${currentFIndex + 1}. ${q.q}</p>
                <div class="flex flex-col gap-3 text-sm">
                    ${q.opts.map((o, i) => `
                        <label class="flex items-center gap-3 cursor-pointer p-4 bg-white dark:bg-slate-900 border rounded-xl hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 border-slate-200 dark:border-slate-700 transition-all font-bold has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50 dark:has-[:checked]:bg-rose-900/50 has-[:checked]:text-rose-700 dark:has-[:checked]:text-rose-400">
                            <input type="radio" name="finalTest_q${currentFIndex}" value="${i}" class="w-5 h-5 text-rose-600" ${selectedAns === i ? 'checked' : ''}>
                            <span>${o}</span>
                        </label>
                    `).join('')}
                    <label class="flex items-center gap-3 cursor-pointer p-4 bg-white dark:bg-slate-900 border rounded-xl hover:border-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 transition-all font-bold has-[:checked]:border-slate-500 has-[:checked]:bg-slate-100 dark:has-[:checked]:bg-slate-800 has-[:checked]:text-slate-700 dark:has-[:checked]:text-slate-400">
                        <input type="radio" name="finalTest_q${currentFIndex}" value="-1" class="w-5 h-5 text-slate-600" ${selectedAns === -1 ? 'checked' : ''}>
                        <span>Não sei responder (Pular)</span>
                    </label>
                </div>
            </div>
        `;
    }
};

window.nextFinalQuestion = (dir) => {
    const selected = document.querySelector(`input[name="finalTest_q${currentFIndex}"]:checked`);
    const q = finalExamQuestions[currentFIndex];
    
    const val = selected ? parseInt(selected.value) : -1;
    finalExamResults[currentFIndex] = { category: q.cat, correct: val === q.correct, questionIndex: currentFIndex, selected: val };

    if (dir > 0) {
        if (currentFIndex < finalExamQuestions.length - 1) {
            currentFIndex++;
            window.renderFinalQuestion();
        } else {
            window.submitFinalExam();
        }
    } else {
        if (currentFIndex > 0) {
            currentFIndex--;
            window.renderFinalQuestion();
        }
    }
};

window.submitFinalExam = () => {
    const correctCount = finalExamResults.filter(r => r && r.correct).length;
    const score = Math.round((correctCount / finalExamQuestions.length) * 100);
    
    localStorage.setItem('study_final_test_done', 'true');
    window.saveEvaluationResult('avaliacao', score, correctCount, finalExamQuestions.length);

    const ui = document.getElementById('final-ui');
    if(ui) ui.classList.add('hidden');
    
    // Avança para a autoeficácia pós-teste como view integrada
    window.showView('efficacy');
};

// --- LÓGICA DO PRÉ-TESTE (Baseline) ---
window.renderPreQuestion = () => {
    const q = finalExamQuestions[currentPreIndex];
    const preCount = document.getElementById('pre-count');
    const preProgress = document.getElementById('pre-progress');
    const content = document.getElementById('pre-test-content');
    const btnPrev = document.getElementById('btn-pre-prev');
    const btnNext = document.getElementById('btn-pre-next');

    if(preCount) preCount.innerText = `${currentPreIndex + 1} / ${finalExamQuestions.length}`;
    if(preProgress) preProgress.style.width = `${((currentPreIndex + 1) / finalExamQuestions.length) * 100}%`;

    if(btnPrev) {
        if(currentPreIndex > 0) btnPrev.classList.remove('hidden');
        else btnPrev.classList.add('hidden');
    }
    
    if(btnNext) {
        btnNext.textContent = (currentPreIndex === finalExamQuestions.length - 1) ? "Finalizar Baseline" : "Avançar";
    }

    const selectedAns = preTestResults[currentPreIndex] ? preTestResults[currentPreIndex].selected : null;

    if(content) {
        content.innerHTML = `
            <div class="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                <p class="font-bold text-slate-700 dark:text-slate-200 mb-4">${currentPreIndex + 1}. ${q.q}</p>
                <div class="flex flex-col gap-3 text-sm">
                    ${q.opts.map((o, i) => `
                        <label class="flex items-center gap-3 cursor-pointer p-4 bg-white dark:bg-slate-900 border rounded-xl hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 border-slate-200 dark:border-slate-700 transition-all font-bold has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50 dark:has-[:checked]:bg-rose-900/50 has-[:checked]:text-rose-700 dark:has-[:checked]:text-rose-400">
                            <input type="radio" name="preTest_q${currentPreIndex}" value="${i}" class="w-5 h-5 text-rose-600" ${selectedAns === i ? 'checked' : ''}>
                            <span>${o}</span>
                        </label>
                    `).join('')}
                    <label class="flex items-center gap-3 cursor-pointer p-4 bg-white dark:bg-slate-900 border rounded-xl hover:border-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 transition-all font-bold has-[:checked]:border-slate-500 has-[:checked]:bg-slate-100 dark:has-[:checked]:bg-slate-800 has-[:checked]:text-slate-700 dark:has-[:checked]:text-slate-400">
                        <input type="radio" name="preTest_q${currentPreIndex}" value="-1" class="w-5 h-5 text-slate-600" ${selectedAns === -1 ? 'checked' : ''}>
                        <span>Não sei responder (Pular)</span>
                    </label>
                </div>
            </div>
        `;
    }
};

window.nextPreQuestion = (dir) => {
    const selected = document.querySelector(`input[name="preTest_q${currentPreIndex}"]:checked`);
    const q = finalExamQuestions[currentPreIndex];
    
    const val = selected ? parseInt(selected.value) : -1;
    preTestResults[currentPreIndex] = { correct: val === q.correct, selected: val };

    if (dir > 0) {
        if (currentPreIndex < finalExamQuestions.length - 1) {
            currentPreIndex++;
            window.renderPreQuestion();
        } else {
            window.submitPreTest();
        }
    } else {
        if (currentPreIndex > 0) {
            currentPreIndex--;
            window.renderPreQuestion();
        }
    }
};

window.submitPreTest = async () => {
    const correctCount = preTestResults.filter(r => r && r.correct).length;
    const score = Math.round((correctCount / finalExamQuestions.length) * 100);
    
    localStorage.setItem('study_baseline_done', 'true');
    localStorage.setItem('study_pre_test_score', score.toString());
    
    // Envio para o Supabase
    const session = await window.getSession();
    const userId = session?.user?.id || 'anon';
    
    if (window.db) {
        const preTestData = {
            user_id: userId,
            score: correctCount,
            total: finalExamQuestions.length,
            percent: score,
            passed: score >= 80,
            type: 'pre_teste'
        };
        await window.db.insert('quiz_attempts', preTestData);
    }

    const content = document.getElementById('pre-test-content');
    if(content) {
        content.innerHTML = `
            <div class="p-12 bg-rose-50 dark:bg-rose-900/20 rounded-[3rem] border-2 border-rose-100 dark:border-slate-800 text-center">
                <h3 class="text-4xl font-black mb-2 text-rose-900 dark:text-rose-400 italic">Resultado da Baseline</h3>
                <p class="text-slate-500 mb-6">Seu nível de conhecimento inicial foi computado.</p>
                <div class="text-8xl font-black text-rose-700 dark:text-rose-600 mb-4">${score}%</div>
                <button onclick="window.finishPreTestUI()" class="w-full bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-wide mt-4 transition-all shadow-xl">Prosseguir para o Treinamento</button>
            </div>
        `;
    }
    
    // Ocultar navegação original do teste
    const container = document.getElementById('pre-test-container');
    if(container) {
        const nav = container.querySelector('.flex.gap-4.mt-8');
        if(nav) nav.classList.add('hidden');
    }
};

window.finishPreTestUI = () => {
    localStorage.setItem('study_baseline_done', 'true'); 
    if(window.checkStudyPhase) window.checkStudyPhase();
    if(window.showView) window.showView('introducao');
};

// Abre a janela de login
window.openAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
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

window.saveEvaluationResult = async (type, percent, correct, total) => {
    const session = await window.getSession();
    const userId = session?.user?.id || 'anon';
    
    // Fallback Local
    const localAttempt = {
        id: Date.now(),
        date: new Date().toISOString(),
        type: type,
        score: correct,
        total: total,
        percent: percent,
        passed: percent >= 80,
        source: 'local'
    };
    let localHistory = JSON.parse(localStorage.getItem('bls_quiz_attempts')) || [];
    localHistory.push(localAttempt);
    localStorage.setItem('bls_quiz_attempts', JSON.stringify(localHistory));

    // Nuvem (Supabase)
    if(window.db) {
        const cloudAttempt = {
            user_id: userId,
            score: correct,
            total: total,
            percent: percent,
            passed: percent >= 80,
            type: type,
            date: new Date().toISOString()
        };
        await window.db.insert('quiz_attempts', cloudAttempt);
    }
};



window.submitProfile = async (e) => {
    e.preventDefault();
    const session = await window.getSession();
    const userId = session.user.id;

    const idade = document.getElementById('input-idade').value;
    const genero = document.querySelector('input[name="input-genero"]:checked')?.value;
    const setor = document.querySelector('input[name="input-setor"]:checked')?.value;
    const vinculo = document.querySelector('input[name="input-vinculo"]:checked')?.value;
    const exp = document.querySelector('input[name="input-exp"]:checked')?.value;

    const profileData = {
        user_id: userId,
        idade: parseInt(idade),
        genero,
        setor,
        vinculo,
        experiencia_previa: exp
    };

    // Salva local e nuvem
    localStorage.setItem('study_profile_type', setor);
    localStorage.setItem('study_profile_done', 'true');
    localStorage.setItem('study_profile_data', JSON.stringify(profileData));

    if (window.db) {
        await window.db.insert('participantes', profileData);
    }

    window.checkStudyPhase();
};

window.submitPreEfficacy = async () => {
    const session = await window.getSession();
    const userId = session.user.id;
    
    const responses = [];
    for(let i=1; i<=4; i++) {
        const val = document.querySelector(`input[name="preeff${i}"]:checked`)?.value;
        if(val) {
            responses.push({ user_id: userId, fase: 'pre', pergunta_id: i, valor: parseInt(val) });
        }
    }

    if (responses.length > 0 && window.db) {
        await window.db.insert('autoeficacia_usabilidade', responses);
    }

    localStorage.setItem('study_pre_efficacy_done', 'true');
    window.checkStudyPhase();
};

window.submitEfficacy = async () => {
    const session = await window.getSession();
    const userId = session.user.id;
    
    const responses = [];
    for(let i=1; i<=4; i++) {
        const val = document.querySelector(`input[name="eff${i}"]:checked`)?.value;
        if(val) {
            responses.push({ user_id: userId, fase: 'pos', pergunta_id: i, valor: parseInt(val) });
        }
    }

    // Executa o insert em segundo plano para não travar a UI
    if (responses.length > 0 && window.db) {
        window.db.insert('autoeficacia_usabilidade', responses).catch(err => console.error("Erro background save:", err));
    }

    localStorage.setItem('study_post_efficacy_done', 'true');
    
    // Mudança de UI INSTANTÂNEA
    window.showView('ux');
    
    console.log("[Autoeficácia] Fluxo avançado para UX.");
};

window.submitUX = async () => {
    const session = await window.getSession();
    const userId = session.user.id;
    const suggestions = document.getElementById('ux-suggestions')?.value || "";
    
    const uxData = {
        user_id: userId,
        ux1: parseInt(document.querySelector('input[name="ux1"]:checked')?.value || 0),
        ux2: parseInt(document.querySelector('input[name="ux2"]:checked')?.value || 0),
        ux3: parseInt(document.querySelector('input[name="ux3"]:checked')?.value || 0),
        ux4: parseInt(document.querySelector('input[name="ux4"]:checked')?.value || 0),
        ux5: parseInt(document.querySelector('input[name="ux5"]:checked')?.value || 0),
        suggestions: suggestions
    };

    if (window.db) {
        await window.db.insert('ux_evaluation', uxData);
    }

    localStorage.setItem('study_ux_done', 'true');
    localStorage.setItem('study_ux_suggestions', suggestions);

    let score = 0;
    if(typeof finalExamQuestions !== "undefined" && finalExamQuestions.length > 0) {
        const correctCount = finalExamResults.filter(r => r && r.correct).length;
        score = Math.round((correctCount / finalExamQuestions.length) * 100);
    }
    
    window.showView('avaliacao-final');
    window.showFinalResults(score);
};

window.showFinalResults = (score) => {
    const intro = document.getElementById('final-intro');
    if(intro) {
        intro.classList.remove('hidden');
        
        // Obter a nota do Pré-Teste
        const preScoreStr = localStorage.getItem('study_pre_test_score');
        const preScore = preScoreStr ? parseInt(preScoreStr) : 0;
        
        // Calcular o ganho de aprendizado
        const gain = score - preScore;
        const gainSign = gain >= 0 ? '+' : '';
        const gainClass = gain > 0 
            ? 'bg-emerald-600 dark:bg-emerald-700 text-white' 
            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
            
        let feedbackMessage = '';
        if (gain > 0) {
            feedbackMessage = `Você obteve um ganho de <strong>${gain}%</strong> de conhecimento teórico imediato após interagir com a nossa plataforma digital!`;
        } else if (score >= 80) {
            feedbackMessage = `Você manteve um excelente nível de conhecimento teórico de <strong>${score}%</strong>!`;
        } else {
            feedbackMessage = `Você concluiu todas as etapas da pesquisa! Seu nível final foi de ${score}%.`;
        }

        let content = `
            <div class="p-8 md:p-12 bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-8 animate-in zoom-in duration-300">
                <div class="space-y-2">
                    <h3 class="text-3xl md:text-4xl font-black text-blue-900 dark:text-blue-400 uppercase italic">Painel de Evolução</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">Muito obrigado! Sua participação é fundamental para validar a usabilidade e eficácia pedagógica da plataforma.</p>
                </div>

                <!-- Painel Comparativo de Notas -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- PRÉ-TESTE -->
                    <div class="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-750 flex flex-col justify-center">
                        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Desempenho Inicial (Pré-Teste)</span>
                        <div class="text-4xl font-black text-slate-700 dark:text-slate-300">${preScore}%</div>
                    </div>
                    
                    <!-- PÓS-TESTE -->
                    <div class="p-6 bg-blue-50 dark:bg-blue-950/20 rounded-3xl border border-blue-100 dark:border-blue-900/30 flex flex-col justify-center">
                        <span class="text-[9px] font-black uppercase text-blue-500 tracking-wider mb-2">Desempenho Final (Pós-Teste)</span>
                        <div class="text-4xl font-black text-blue-700 dark:text-blue-400">${score}%</div>
                    </div>

                    <!-- EVOLUÇÃO -->
                    <div class="p-6 ${gainClass} rounded-3xl flex flex-col justify-center shadow-lg">
                        <span class="text-[9px] font-black uppercase tracking-wider mb-2 opacity-80">Evolução Individual (Ganho)</span>
                        <div class="text-4xl font-black">${gainSign}${gain}%</div>
                    </div>
                </div>

                <!-- Caixa explicativa sobre os objetivos da pesquisa -->
                <div class="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-left text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-4">
                    <p class="font-bold text-slate-800 dark:text-white uppercase text-xs tracking-wider">Análise Científica de Impacto:</p>
                    <p>${feedbackMessage} O objetivo principal deste estudo é avaliar o ganho individual de aprendizado comparando a autoeficácia e o acerto teórico antes e depois do uso da plataforma autoinstrucional.</p>
                    <div class="flex items-center gap-3 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl">
                        <span class="text-lg">✓</span>
                        <span>Seus dados foram pareados e armazenados com sucesso de forma totalmente anônima.</span>
                    </div>
                </div>

                <!-- Botões de Ação -->
                <div class="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                    <button onclick="window.showView('hero')" class="bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Ir para a Tela Inicial</button>
                </div>
            </div>
        `;

        intro.innerHTML = content;
    }
};

window.checkStudyPhase = () => {
    const hasTCLE = localStorage.getItem('study_tcle_accepted') === 'true';
    const hasProfile = localStorage.getItem('study_profile_done') === 'true';
    const hasBaseline = localStorage.getItem('study_baseline_done') === 'true';
    
    if (!hasTCLE || !hasProfile || !hasBaseline) {
        if (!hasTCLE) {
            window.showView('tcle');
        } else if (!hasProfile) {
            window.showView('profile');
        } else if (!hasBaseline) {
            const hasPreEfficacy = localStorage.getItem('study_pre_efficacy_done') === 'true';
            if (!hasPreEfficacy) {
                window.showView('pre-efficacy');
            } else {
                window.showView('pre-test');
            }
        }
    } else {
        // Exibe a tela principal do sistema ou recupera o progresso salvo
        if(window.showView) {
            const savedView = localStorage.getItem('current_study_view');
            const focusViews = ['tcle', 'profile', 'pre-efficacy', 'pre-test', 'efficacy', 'ux'];
            if (savedView && savedView !== 'developer' && !focusViews.includes(savedView)) {
                window.showView(savedView);
            } else {
                window.showView('introducao'); // Leva direto à introdução do treinamento se acabou a baseline
            }
        }
    }
};

window.checkTCLEScroll = () => {
    const el = document.getElementById('tcle-content');
    const btn = document.getElementById('btn-accept-tcle');
    if (!el || !btn) return;
    
    // Verificação robusta de scroll total (tolerância de 10px para mobile)
    const scrollTotal = el.scrollHeight;
    const currentScroll = el.scrollTop + el.clientHeight;
    const isBottom = scrollTotal - currentScroll <= 10;
    
    if (isBottom && btn.disabled) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:scale-105', 'active:scale-95', 'bg-blue-600');
        btn.innerHTML = "Li e Aceito Participar";
        console.log("[TCLE] Scroll finalizado. Botão habilitado.");
    }
};

window.downloadTCLE = () => {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        let yPos = 25;
        const marginX = 20;
        const pageHeight = pdf.internal.pageSize.height;
        const pageWidth = pdf.internal.pageSize.width;
        const printableWidth = pageWidth - (2 * marginX); // 170

        // Helper to check page bounds and auto-add page
        const checkPageBreak = (neededHeight) => {
            if (yPos + neededHeight > pageHeight - 25) {
                // Add page number footer before adding new page
                pdf.setFontSize(8);
                pdf.setFont("helvetica", "normal");
                pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

                pdf.addPage();
                yPos = 25;
                return true;
            }
            return false;
        };

        const sections = [
            { type: 'header', text: 'UNIVERSIDADE FEDERAL DE SERGIPE' },
            { type: 'header', text: 'DEPARTAMENTO DE MEDICINA DE LAGARTO' },
            { type: 'header_sub', text: 'COMITÊ DE ÉTICA EM PESQUISA ENVOLVENDO SERES HUMANOS' },
            { type: 'line' },
            { type: 'title', text: 'TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA PESQUISAS EM AMBIENTE VIRTUAL' },
            { type: 'subtitle', text: 'Modelo adaptado do CEP Unifesp e baseado na Resolução CNS 510/2016 e no Ofício Circular 2/2021/CONEP/SECNS/MS' },
            
            { type: 'paragraph', text: 'Você está sendo convidado(a) a participar da pesquisa "Avaliação de Impacto e Usabilidade de uma Ferramenta Digital para o Ensino de Suporte Básico de Vida no Hospital Universitário de Lagarto". O objetivo desta pesquisa é avaliar o impacto de uma plataforma digital autoinstrucional no conhecimento teórico e na percepção de autoeficácia sobre Suporte Básico de Vida (SBV) na comunidade hospitalar.' },
            
            { type: 'heading', text: 'Pesquisadores Responsáveis' },
            { type: 'paragraph', text: 'A pesquisadora responsável é a Profa. Dra. Evelyn de Oliveira Machado (Orientadora), docente do Departamento de Medicina da UFS-Lagarto, tendo como coorientador o Prof. Dr. Thiago da Silva Mendes, docente do Departamento de Medicina da UFS-Lagarto, além do pesquisador assistente, o discente Gabriel Carvalho Moreira.' },
            
            { type: 'heading', text: 'Procedimentos da Pesquisa' },
            { type: 'paragraph', text: 'Caso aceite participar, você acessará uma plataforma digital educativa (WebApp) via smartphone, tablet ou computador. O conteúdo e a interface da plataforma foram validados por um comitê de especialistas através do Índice de Validade de Conteúdo (IVC), método científico que assegura a precisão técnica das instruções de Suporte Básico de Vida e a adequação pedagógica do sistema, garantindo que o recurso esteja alinhado aos padrões internacionais antes da sua disponibilização. O fluxo da pesquisa seguirá as seguintes etapas:' },
            { type: 'bullet', text: '• Consentimento: Leitura e aceite obrigatórios deste Termo de Consentimento para início da navegação na plataforma;' },
            { type: 'bullet', text: '• Perfil Sociodemográfico: Preenchimento obrigatório de dados de caracterização (idade, gênero, escolaridade, setor de atuação e experiência prévia em SBV), necessários para validação do vínculo institucional e caracterização da amostra;' },
            { type: 'bullet', text: '• Etapa Inicial: Avaliação de conhecimento prévio através de questionário técnico (Pré-teste) seguida do primeiro questionário de Autoeficácia;' },
            { type: 'bullet', text: '• Intervenção Educativa: Acesso ao conteúdo autoinstrucional sobre Suporte Básico de Vida, baseado nas diretrizes da American Heart Association (AHA);' },
            { type: 'bullet', text: '• Etapa Final: Avaliação de conhecimento pós-intervenção (Pós-teste), seguida do segundo questionário de Autoeficácia e escala de usabilidade da plataforma.' },
            
            { type: 'paragraph', text: 'O tempo total estimado para a realização de todas as etapas é de aproximadamente 20 a 30 minutos, podendo variar conforme o ritmo individual de cada participante. A coleta de dados ocorrerá no período de novembro de 2026 a março de 2027, tendo como público-alvo toda a comunidade hospitalar do Hospital Universitário de Lagarto (profissionais de saúde, colaboradores de setores não assistenciais, estudantes e residentes), exceto aqueles que se encontrarem em período de licença médica ou férias durante a execução da pesquisa.' },
            
            { type: 'paragraph', text: 'Esclarecemos que, embora o aceite deste termo e o preenchimento do perfil sociodemográfico sejam requisitos para o prosseguimento nas etapas da plataforma, as perguntas técnicas contidas no Pré-teste, Pós-teste e em ambas as escalas de Autoeficácia não são de preenchimento obrigatório. O participante poderá deixar itens em branco ou saltar questões sem que isso impeça o prosseguimento na ferramenta ou acarrete qualquer penalidade.' },
            
            { type: 'heading', text: 'Riscos' },
            { type: 'paragraph', text: 'Toda pesquisa envolvendo seres humanos pode oferecer riscos aos participantes. Nesta pesquisa, os riscos são classificados como mínimos. Durante a participação, pode haver eventual desconforto relacionado à autoavaliação dos conhecimentos sobre o tema a partir das respostas fornecidas nos questionários. Esse risco é reduzido pela natureza anônima da coleta de dados, pela não solicitação de informações identificáveis nas etapas iniciais e pelo compromisso da equipe com a confidencialidade das informações, assegurando a proteção da imagem, da dignidade e a não estigmatização dos participantes.' },
            { type: 'paragraph', text: 'Considerando que a coleta será realizada em ambiente virtual, há riscos adicionais característicos desse meio, conforme orientações da Carta Circular nº 1/2021-CONEP:' },
            { type: 'bullet', text: '1. Possibilidade de vazamento ou perda de dados em decorrência de falhas técnicas das plataformas digitais utilizadas;' },
            { type: 'bullet', text: '2. Acesso não autorizado ou interceptação indevida por terceiros, mesmo com o uso de ferramentas digitais seguras;' },
            { type: 'bullet', text: '3. Falhas de conexão ou instabilidades técnicas que possam afetar o envio ou a integridade das respostas;' },
            { type: 'bullet', text: '4. Rastreamento inadvertido de comportamento online por terceiros durante o acesso à plataforma.' },
            { type: 'paragraph', text: 'Para mitigar esses riscos, os dados serão armazenados em ambiente virtual seguro (Supabase/PostgreSQL) com acesso restrito à equipe de pesquisa e protegido por mecanismos de autenticação e criptografia. A plataforma foi selecionada com base em critérios de segurança, confiabilidade e conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018). Recomenda-se que você responda aos questionários em local reservado, utilizando sempre que possível um dispositivo de uso pessoal (computador, tablet ou celular), garantindo maior privacidade e proteção das informações fornecidas. A plataforma não compartilha dados com terceiros e não utiliza cookies de rastreamento para fins comerciais.' },
            
            { type: 'heading', text: 'Benefícios' },
            { type: 'paragraph', text: 'O benefício direto é o acesso gratuito a uma ferramenta de atualização em Suporte Básico de Vida, contribuindo para o aprimoramento do seu conhecimento técnico e para o fortalecimento da cultura de segurança do paciente na instituição. Além disso, sua participação contribuirá para o reconhecimento das necessidades de capacitação da comunidade hospitalar do HUL, auxiliando em futuras ações de educação permanente.' },
            
            { type: 'heading', text: 'Confidencialidade, Privacidade e Proteção de Dados' },
            { type: 'paragraph', text: 'Este estudo segue rigorosamente as diretrizes da Resolução CNS nº 466/2012, Resolução CNS nº 510/2016 e a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018). Seu nome não será divulgado em nenhuma publicação científica derivada deste estudo. Os dados técnicos serão identificados por códigos alfanuméricos e armazenados em banco de dados seguro, com acesso restrito aos pesquisadores responsáveis. Ressalta-se que dados de identificação pessoal (como nome completo e CPF) não serão solicitados em nenhuma etapa da pesquisa. Todos os dados coletados serão tratados de forma anonimizada, sendo identificados apenas por códigos alfanuméricos gerados automaticamente pelo sistema, garantindo que a análise do conhecimento e da usabilidade permaneça totalmente desvinculada de qualquer informação que possa identificar os participantes.' },
            { type: 'paragraph', text: 'Os dados coletados nesta pesquisa serão utilizados para análise de impacto da ferramenta, produção de relatórios institucionais e poderão compor o Trabalho de Conclusão de Curso (TCC) do pesquisador assistente Gabriel Carvalho Moreira, bem como artigos científicos e apresentações em congressos, mantendo-se sempre o anonimato dos participantes. Os dados serão armazenados pelo período de 5 anos, conforme determina a legislação vigente, e após esse prazo serão permanentemente excluídos.' },
            
            { type: 'heading', text: 'Voluntariedade e Direito de Retirada' },
            { type: 'paragraph', text: 'Sua participação é totalmente voluntária. Você é livre para não responder a qualquer pergunta ou abandonar a pesquisa a qualquer momento, sem qualquer penalidade ou prejuízo em seu vínculo com a instituição. Você pode solicitar a exclusão de seus dados a qualquer momento enviando um e-mail para gabriel0803@academico.ufs.br, identificando-se pelo código de usuário fornecido pela plataforma.' },
            
            { type: 'heading', text: 'Custos e Indenização' },
            { type: 'paragraph', text: 'Não haverá pagamento pela participação nesta pesquisa. Caso haja qualquer gasto comprovado decorrente diretamente da pesquisa, este será ressarcido pelos pesquisadores responsáveis. Se houver dano pessoal comprovado decorrente da pesquisa, o participante tem direito a buscar indenização conforme a legislação vigente (Resolução CNS nº 510/2016).' },
            
            { type: 'heading', text: 'Contatos' },
            { type: 'paragraph', text: '• Pesquisadora Responsável: Profa. Dra. Evelyn de Oliveira Machado | Tel: (79) 98837-3987 | E-mail: evelyn.machado@gmail.com\n• Coorientador: Prof. Dr. Thiago da Silva Mendes\n• Pesquisador Assistente: Gabriel Carvalho Moreira | Tel: (79) 99808-0371 | E-mail: gabriel0803@academico.ufs.br\n• Comitê de Ética em Pesquisa (CEP-HUL/UFS): Av. Gov. Marcelo Déda, 13, Centro, Lagarto/SE, CEP 49400-000 | Tel: (79) 3632-2189 | E-mail: cephulag@ufs.br | Horário de atendimento: segunda a sexta-feira, das 08h às 12h.' },
            
            { type: 'heading', text: 'Declaração de Consentimento' },
            { type: 'paragraph', text: 'Ao assinalar "Concordo" abaixo, você declara que:\n● Leu e compreendeu todas as informações contidas neste Termo de Consentimento Livre e Esclarecido;\n● Teve a oportunidade de esclarecer suas dúvidas através dos contatos fornecidos;\n● Compreendeu os objetivos, procedimentos, riscos e benefícios da pesquisa;\n● Aceita participar voluntariamente desta pesquisa.\nRecomendamos que você salve ou imprima uma cópia deste documento para seus registros.' },
            
            { type: 'spacer' },
            { type: 'signature' }
        ];

        sections.forEach(sec => {
            if (sec.type === 'header') {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                checkPageBreak(8);
                pdf.text(sec.text, pageWidth / 2, yPos, { align: 'center' });
                yPos += 5.5;
            } else if (sec.type === 'header_sub') {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7.5);
                checkPageBreak(6);
                pdf.text(sec.text, pageWidth / 2, yPos, { align: 'center' });
                yPos += 4.5;
            } else if (sec.type === 'line') {
                checkPageBreak(4);
                pdf.setLineWidth(0.3);
                pdf.setDrawColor(200, 200, 200);
                pdf.line(marginX, yPos, pageWidth - marginX, yPos);
                yPos += 5.5;
            } else if (sec.type === 'title') {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(9.5);
                const lines = pdf.splitTextToSize(sec.text, printableWidth);
                checkPageBreak(lines.length * 5.5);
                lines.forEach(line => {
                    pdf.text(line, pageWidth / 2, yPos, { align: 'center' });
                    yPos += 5;
                });
                yPos += 1.5;
            } else if (sec.type === 'subtitle') {
                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(7.5);
                const lines = pdf.splitTextToSize(sec.text, printableWidth);
                checkPageBreak(lines.length * 4.5);
                lines.forEach(line => {
                    pdf.text(line, pageWidth / 2, yPos, { align: 'center' });
                    yPos += 4;
                });
                yPos += 3;
            } else if (sec.type === 'heading') {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(9);
                checkPageBreak(10);
                yPos += 1.5;
                pdf.text(sec.text, marginX, yPos);
                yPos += 5;
            } else if (sec.type === 'paragraph' || sec.type === 'bullet') {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8.2);
                
                // Handle newlines if present
                const rawParagraphs = sec.text.split('\n');
                rawParagraphs.forEach(rawP => {
                    const lines = pdf.splitTextToSize(rawP, sec.type === 'bullet' ? printableWidth - 5 : printableWidth);
                    lines.forEach(line => {
                        checkPageBreak(4.5);
                        const x = sec.type === 'bullet' ? marginX + 4 : marginX;
                        pdf.text(line, x, yPos);
                        yPos += 4.2;
                    });
                    yPos += 1;
                });
                yPos += 1.5; // space after paragraph
            } else if (sec.type === 'spacer') {
                yPos += 4;
            } else if (sec.type === 'signature') {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(8);
                const dateStr = new Date().toLocaleString('pt-BR');
                const participantCode = localStorage.getItem('study_user_code') || 'N/A';
                
                const sigText = [
                    '-------------------------------------------------------------------------------------------------',
                    'REGISTRO DE ACEITE DIGITAL DO PARTICIPANTE',
                    `Código do Participante: ${participantCode}`,
                    `Data/Hora do Aceite: ${dateStr}`,
                    'Assinado eletronicamente via LifeSupport Pro Platform.'
                ];
                
                checkPageBreak(25);
                sigText.forEach(line => {
                    pdf.text(line, marginX, yPos);
                    yPos += 4;
                });
            }
        });

        // Add last page number footer
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
        
        pdf.save('TCLE_Assinado_CEP.pdf');
        
    } catch(err) {
        console.error("Erro ao gerar PDF do TCLE:", err);
        alert("Ocorreu um erro ao gerar o PDF. Verifique se o navegador suporta esta ação.");
    }
};

window.acceptTCLE = () => {
    localStorage.setItem('study_tcle_accepted', 'true');
    window.checkStudyPhase();
};


// --- LÓGICA DO PAINEL DO DESENVOLVEDOR ---

let devClickCount = 0;
window.triggerDevPanel = () => {
    devClickCount++;
    if (devClickCount >= 5) {
        devClickCount = 0;
        const password = prompt("Digite a senha de desenvolvedor para acessar o painel:");
        if (password === "tccdev2026") {
            window.showView('developer');
        } else if (password !== null) {
            alert("Senha incorreta!");
        }
    }
};

// Intercepta e altera a função showView para carregar os dados se for a view developer,
// além de aplicar regras de restrição de fluxo do participante, salvar progresso e atualizar a barra.
const originalShowView = window.showView;
window.showView = (v) => {
    // 1. Marcar como Dev se acessou o painel do desenvolvedor
    if (v === 'developer') {
        localStorage.setItem('is_dev_user', 'true');
        window.loadDeveloperData();
    }

    // 2. Travar o progresso caso o participante tente pular o treinamento
    if (v === 'avaliacao-final' || v === 'pratica') {
        const isTrainingDone = localStorage.getItem('study_training_done') === 'true';
        const isDev = localStorage.getItem('is_dev_user') === 'true' || new URLSearchParams(window.location.search).has('dev');
        if (!isTrainingDone && !isDev) {
            alert("Atenção: Para realizar a Avaliação Final ou o Simulador de Casos, você deve primeiro concluir a leitura de todos os módulos de treinamento!");
            v = 'introducao';
        }
    }

    // Se for a avaliação final e já tiver sido realizada, mostramos diretamente a tela de resultados
    if (v === 'avaliacao-final' && localStorage.getItem('study_final_test_done') === 'true') {
        setTimeout(() => {
            const localHistory = JSON.parse(localStorage.getItem('bls_quiz_attempts')) || [];
            const finalAttempt = localHistory.slice().reverse().find(a => a.type === 'avaliacao');
            const score = finalAttempt ? finalAttempt.percent : 0;
            
            const finalUi = document.getElementById('final-ui');
            if (finalUi) finalUi.classList.add('hidden');
            
            window.showFinalResults(score);
        }, 50);
    }

    // 3. Salvar progresso de tela ativa no localStorage (exceto developer)
    if (v !== 'developer') {
        localStorage.setItem('current_study_view', v);
    }

    // 4. Executar comportamento original de troca de telas
    if (originalShowView) {
        originalShowView(v);
    } else {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`view-${v}`);
        if(target) target.classList.add('active');
        window.scrollTo(0,0);
    }

    // Se for pré-teste, inicializa a renderização
    if (v === 'pre-test') {
        window.renderPreQuestion();
    }

    // 5. Fechar barra lateral se estiver aberta (Melhoria de UX)
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    // 6. Modo Foco (Ocultar cabeçalho em telas de onboarding ou questionários do participante)
    const header = document.querySelector('header');
    const isFocusView = ['tcle', 'profile', 'pre-efficacy', 'pre-test', 'efficacy', 'ux'].includes(v);
    if (header) {
        if (isFocusView) {
            header.classList.add('hidden');
        } else {
            header.classList.remove('hidden');
        }
    }
    const progBar = document.getElementById('research-progress-bar');
    if (progBar && v !== 'developer') {
        if (isFocusView) {
            progBar.classList.replace('top-20', 'top-0');
        } else {
            progBar.classList.replace('top-0', 'top-20');
        }
    }

    // 7. Atualizar a barra de progresso visual do funil
    if (window.updateFunnelProgress) {
        window.updateFunnelProgress(v);
    }
};

window.updateFunnelProgress = (currentView) => {
    const hasTCLE = localStorage.getItem('study_tcle_accepted') === 'true';
    const hasProfile = localStorage.getItem('study_profile_done') === 'true';
    const hasBaseline = localStorage.getItem('study_baseline_done') === 'true';
    const hasTraining = localStorage.getItem('study_training_done') === 'true';
    const hasPostTest = localStorage.getItem('study_final_test_done') === 'true';

    // Ocultar a barra de progresso se estiver no painel do desenvolvedor
    const progBar = document.getElementById('research-progress-bar');
    if (progBar) {
        if (currentView === 'developer') {
            progBar.style.display = 'none';
        } else {
            progBar.style.display = 'block';
        }
    }

    // Mostrar/ocultar o lembrete de pós-teste
    const reminderBanner = document.getElementById('training-reminder-banner');
    if (reminderBanner) {
        const isTrainingView = ['introducao', 'seguranca', 'teoria', 'diferencas', 'leigos', 'diferenciacao', 'dea', 'ovace', 'metronomo', 'flashcards', 'duvidas', 'glossario', 'hero'].includes(currentView);
        const hasPostTest = localStorage.getItem('study_final_test_done') === 'true';
        
        if (isTrainingView && !hasPostTest && currentView !== 'developer') {
            reminderBanner.style.display = 'block';
        } else {
            reminderBanner.style.display = 'none';
        }
    }

    if (currentView === 'developer') return;

    let activeStep = 1;
    if (!hasTCLE) {
        activeStep = 1;
    } else if (!hasProfile) {
        activeStep = 2;
    } else if (!hasBaseline) {
        activeStep = 3;
    } else if (!hasTraining && currentView !== 'pratica' && currentView !== 'avaliacao-final') {
        activeStep = 4;
    } else if (!hasPostTest || currentView === 'pratica' || currentView === 'avaliacao-final') {
        activeStep = 5;
    } else {
        activeStep = 6;
    }

    const steps = [
        { id: 'tcle', num: 1, label: 'Termo' },
        { id: 'profile', num: 2, label: 'Perfil' },
        { id: 'pre', num: 3, label: 'Pré-Teste' },
        { id: 'learn', num: 4, label: 'Treinamento' },
        { id: 'post', num: 5, label: 'Pós-Teste' },
        { id: 'done', num: 6, label: 'Conclusão' }
    ];

    steps.forEach(s => {
        const container = document.getElementById(`prog-step-${s.id}`);
        const icon = document.getElementById(`prog-icon-${s.id}`);
        if (!container || !icon) return;

        if (s.num < activeStep) {
            // Completo (Verde)
            container.className = "flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold transition-all";
            icon.className = "w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold transition-all";
            icon.innerHTML = "✓";
        } else if (s.num === activeStep) {
            // Ativo (Azul com pulse)
            container.className = "flex items-center gap-1.5 text-blue-600 dark:text-blue-400 shrink-0 font-black transition-all";
            icon.className = "w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold animate-pulse transition-all";
            icon.innerHTML = s.num.toString();
        } else {
            // Inativo (Cinza)
            container.className = "flex items-center gap-1.5 text-slate-400 dark:text-slate-500 shrink-0 transition-all";
            icon.className = "w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center text-[9px] font-bold transition-all";
            icon.innerHTML = s.num.toString();
        }
    });
};

window.loadDeveloperData = async () => {
    const container = document.getElementById('developer-table-container');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-500 dark:text-slate-400">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 dark:border-blue-500 mb-4"></div>
                <p class="text-sm font-bold uppercase tracking-wider">Carregando dados da pesquisa...</p>
            </div>
        `;
    }

    try {
        // Busca todas as tabelas em paralelo
        const [
            { data: rawParticipantes, error: errPart },
            { data: rawQuizAttempts, error: errQuiz },
            { data: rawEfficacy, error: errEff },
            { data: rawUx, error: errUx }
        ] = await Promise.all([
            window.supabaseClient.from('participantes').select('*'),
            window.supabaseClient.from('quiz_attempts').select('*'),
            window.supabaseClient.from('autoeficacia_usabilidade').select('*'),
            window.supabaseClient.from('ux_evaluation').select('*')
        ]);

        if (errPart || errQuiz || errEff || errUx) {
            console.error("Supabase Query Error Details:", { errPart, errQuiz, errEff, errUx });
            throw new Error("Erro ao consultar tabelas do Supabase");
        }

        const participantes = rawParticipantes || [];
        const quizAttempts = rawQuizAttempts || [];
        const efficacy = rawEfficacy || [];
        const ux = rawUx || [];

        // Consolidação por user_id
        const userMap = {};

        const getUserEntry = (userId) => {
            if (!userId) userId = 'desconhecido';
            if (!userMap[userId]) {
                userMap[userId] = {
                    user_id: userId,
                    created_at: null,
                    idade: "",
                    genero: "",
                    setor: "",
                    vinculo: "",
                    experiencia_previa: "",
                    pre_test: null,
                    post_test: null,
                    pre_efficacy: {},
                    post_efficacy: {},
                    ux: null
                };
            }
            return userMap[userId];
        };

        // 1. Demografia
        participantes.forEach(p => {
            const entry = getUserEntry(p.user_id);
            entry.created_at = p.created_at;
            entry.idade = p.idade || "";
            entry.genero = p.genero || "";
            entry.setor = p.setor || "";
            entry.vinculo = p.vinculo || "";
            entry.experiencia_previa = p.experiencia_previa || "";
        });

        // 2. Resultados de Quiz
        quizAttempts.forEach(q => {
            const entry = getUserEntry(q.user_id);
            if (!entry.created_at && q.created_at) entry.created_at = q.created_at;
            
            if (q.type === 'pre_teste') {
                entry.pre_test = {
                    score: q.score,
                    total: q.total,
                    percent: q.percent,
                    date: q.date
                };
            } else if (q.type === 'avaliacao' || q.type === 'avaliacao_final') {
                entry.post_test = {
                    score: q.score,
                    total: q.total,
                    percent: q.percent,
                    date: q.date
                };
            }
        });

        // 3. Autoeficácia
        efficacy.forEach(e => {
            const entry = getUserEntry(e.user_id);
            if (e.fase === 'pre') {
                entry.pre_efficacy[e.pergunta_id] = e.valor;
            } else if (e.fase === 'pos') {
                entry.post_efficacy[e.pergunta_id] = e.valor;
            }
        });

        // 4. UX e Usabilidade
        ux.forEach(u => {
            const entry = getUserEntry(u.user_id);
            entry.ux = {
                ux1: u.ux1,
                ux2: u.ux2,
                ux3: u.ux3,
                ux4: u.ux4,
                ux5: u.ux5,
                suggestions: u.suggestions
            };
        });

        // Convert map to array and sort by date desc
        const usersList = Object.values(userMap).sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA;
        });

        window.allDeveloperUsers = usersList;
        window.currentDevUsers = usersList;
        
        window.renderDeveloperMetrics(usersList);
        window.renderDeveloperData(usersList);

    } catch (err) {
        console.error("Erro ao carregar dados do painel do desenvolvedor:", err);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-16 text-rose-600 dark:text-rose-500">
                    <p class="font-black text-xl mb-2">Falha na Conexão Supabase</p>
                    <p class="text-xs text-slate-500 mb-6">Não foi possível recuperar os dados de pesquisa. Verifique seu console para detalhes.</p>
                    <button onclick="window.loadDeveloperData()" class="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs">Tentar Novamente</button>
                </div>
            `;
        }
    }
};

window.renderDeveloperMetrics = (users) => {
    const total = users.length;
    
    // Calculates averages
    let preSum = 0, preCount = 0;
    let postSum = 0, postCount = 0;
    
    let effPreSum = 0, effPreCount = 0;
    let effPostSum = 0, effPostCount = 0;
    let susSum = 0, susCount = 0;
    
    users.forEach(u => {
        // Quiz
        if (u.pre_test && typeof u.pre_test.percent === 'number') {
            preSum += u.pre_test.percent;
            preCount++;
        }
        if (u.post_test && typeof u.post_test.percent === 'number') {
            postSum += u.post_test.percent;
            postCount++;
        }
        
        // Autoeficácia Pré
        if (u.pre_efficacy) {
            Object.values(u.pre_efficacy).forEach(val => {
                if (typeof val === 'number') {
                    effPreSum += val;
                    effPreCount++;
                }
            });
        }
        
        // Autoeficácia Pós
        if (u.post_efficacy) {
            Object.values(u.post_efficacy).forEach(val => {
                if (typeof val === 'number') {
                    effPostSum += val;
                    effPostCount++;
                }
            });
        }
        
        // Usabilidade SUS
        if (u.ux) {
            const vals = [u.ux.ux1, u.ux.ux2, u.ux.ux3, u.ux.ux4, u.ux.ux5].filter(v => typeof v === 'number');
            if (vals.length > 0) {
                susSum += vals.reduce((a,b)=>a+b, 0) / vals.length;
                susCount++;
            }
        }
    });

    const preAvg = preCount > 0 ? Math.round(preSum / preCount) : 0;
    const postAvg = postCount > 0 ? Math.round(postSum / postCount) : 0;
    const gain = postAvg - preAvg;
    
    const effPreAvg = effPreCount > 0 ? (effPreSum / effPreCount).toFixed(2) : "0.00";
    const effPostAvg = effPostCount > 0 ? (effPostSum / effPostCount).toFixed(2) : "0.00";
    const susAvg = susCount > 0 ? (susSum / susCount).toFixed(2) : "0.00";

    document.getElementById('dev-metric-total').innerText = total;
    document.getElementById('dev-metric-pre-avg').innerText = `${preAvg}%`;
    document.getElementById('dev-metric-post-avg').innerText = `${postAvg}%`;
    document.getElementById('dev-metric-gain').innerText = `${gain >= 0 ? '+' : ''}${gain}%`;
    
    const metricEffPre = document.getElementById('dev-metric-eff-pre');
    const metricEffPost = document.getElementById('dev-metric-eff-post');
    const metricSusAvg = document.getElementById('dev-metric-sus-avg');
    
    if (metricEffPre) metricEffPre.innerText = `${effPreAvg} / 5`;
    if (metricEffPost) metricEffPost.innerText = `${effPostAvg} / 5`;
    if (metricSusAvg) metricSusAvg.innerText = `${susAvg} / 5`;
};

window.currentDevTab = 'reports';

window.switchDevTab = (tab) => {
    window.currentDevTab = tab;
    const btnReports = document.getElementById('dev-tab-reports');
    const btnTable = document.getElementById('dev-tab-table');
    const btnStats = document.getElementById('dev-tab-stats');
    if (!btnReports || !btnTable) return;
    
    const activeClass = "flex-1 sm:flex-none text-center px-6 py-3 font-black text-xs uppercase tracking-wide rounded-xl bg-blue-600 text-white shadow-md transition-all focus:outline-none ml-2";
    const activeFirstClass = "flex-1 sm:flex-none text-center px-6 py-3 font-black text-xs uppercase tracking-wide rounded-xl bg-blue-600 text-white shadow-md transition-all focus:outline-none";
    const inactiveClass = "flex-1 sm:flex-none text-center px-6 py-3 font-bold text-xs uppercase tracking-wide rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all focus:outline-none ml-2";
    const inactiveFirstClass = "flex-1 sm:flex-none text-center px-6 py-3 font-bold text-xs uppercase tracking-wide rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all focus:outline-none";

    btnReports.className = tab === 'reports' ? activeFirstClass : inactiveFirstClass;
    btnTable.className = tab === 'table' ? activeClass : inactiveClass;
    if (btnStats) btnStats.className = tab === 'stats' ? activeClass : inactiveClass;
    
    if (window.currentDevUsers) {
        window.renderDeveloperData(window.currentDevUsers);
    } else if (window.allDeveloperUsers) {
        window.filterDeveloperData();
    }
};

window.renderDeveloperData = (users) => {
    if (window.currentDevTab === 'reports') {
        window.renderDeveloperReports(users);
    } else if (window.currentDevTab === 'table') {
        window.renderDeveloperTable(users);
    } else if (window.currentDevTab === 'stats') {
        window.renderDeveloperStats(users);
    }
};

window.renderDeveloperReports = (users) => {
    const container = document.getElementById('developer-table-container');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-500 dark:text-slate-400">
                <p class="text-lg font-bold">Nenhum participante encontrado</p>
                <p class="text-xs">Tente ajustar seus filtros de busca.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 gap-8 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-[2.5rem]">
            ${users.map((u, i) => {
                const dispId = u.user_id.startsWith('anon-') ? `Anon (${u.user_id.slice(-6)})` : u.user_id;
                const preText = u.pre_test ? `${u.pre_test.percent}% (${u.pre_test.score}/${u.pre_test.total})` : "Não realizado";
                const postText = u.post_test ? `${u.post_test.percent}% (${u.post_test.score}/${u.post_test.total})` : "Não realizado";
                
                let evolutionText = "—";
                let evolutionClass = "text-purple-600 dark:text-purple-400";
                if (u.pre_test && u.post_test && typeof u.pre_test.percent === 'number' && typeof u.post_test.percent === 'number') {
                    const diff = u.post_test.percent - u.pre_test.percent;
                    evolutionText = `${diff >= 0 ? '+' : ''}${diff}%`;
                    if (diff > 0) {
                        evolutionClass = "text-emerald-600 dark:text-emerald-500";
                    } else if (diff < 0) {
                        evolutionClass = "text-rose-600 dark:text-rose-455";
                    } else {
                        evolutionClass = "text-slate-500 dark:text-slate-400";
                    }
                }
                
                const preEffVals = Object.values(u.pre_efficacy).filter(v => typeof v === 'number');
                const preEffAvg = preEffVals.length > 0 ? (preEffVals.reduce((a,b)=>a+b, 0) / preEffVals.length).toFixed(1) : "—";
                
                const postEffVals = Object.values(u.post_efficacy).filter(v => typeof v === 'number');
                const postEffAvg = postEffVals.length > 0 ? (postEffVals.reduce((a,b)=>a+b, 0) / postEffVals.length).toFixed(1) : "—";
                
                const uxAvg = u.ux ? (((u.ux.ux1 || 0) + (u.ux.ux2 || 0) + (u.ux.ux3 || 0) + (u.ux.ux4 || 0) + (u.ux.ux5 || 0)) / 5).toFixed(1) : "—";
                
                const preEffList = [1,2,3,4].map(idx => `<div>Questão ${idx}: <span class="font-black text-blue-700 dark:text-blue-400">${(u.pre_efficacy[idx] !== undefined && u.pre_efficacy[idx] !== null) ? u.pre_efficacy[idx] : '—'}/5</span></div>`).join(' • ');
                const postEffList = [1,2,3,4].map(idx => `<div>Questão ${idx}: <span class="font-black text-rose-700 dark:text-rose-400">${(u.post_efficacy[idx] !== undefined && u.post_efficacy[idx] !== null) ? u.post_efficacy[idx] : '—'}/5</span></div>`).join(' • ');
                const uxList = [1,2,3,4,5].map(idx => `<div>SUS ${idx}: <span class="font-black text-emerald-700 dark:text-emerald-400">${(u.ux && u.ux[`ux${idx}`] !== undefined && u.ux[`ux${idx}`] !== null) ? u.ux[`ux${idx}`] : '—'}/5</span></div>`).join(' • ');

                return `
                    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 lg:p-8 shadow-md hover:shadow-lg transition-all relative overflow-hidden">
                        <!-- Card Border Tag -->
                        <div class="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                        
                        <!-- Header -->
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-6 border-b border-slate-100 dark:border-slate-800 w-full">
                            <div>
                                <span class="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500">Participante</span>
                                <div class="flex flex-wrap items-center gap-3 mt-1">
                                    <h4 class="text-xl font-black text-slate-900 dark:text-white">${dispId}</h4>
                                    <button onclick="window.deleteUserRecord('${u.user_id}')" class="text-rose-600 dark:text-rose-455 hover:text-rose-800 dark:hover:text-rose-300 transition-colors text-[9px] font-black uppercase tracking-wider flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                                        🗑️ Excluir
                                    </button>
                                </div>
                            </div>
                            <div class="text-right mt-2 sm:mt-0">
                                <span class="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-xl font-black uppercase">${u.setor || 'Setor N/A'}</span>
                                <div class="text-[10px] text-slate-400 mt-1.5">${u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : 'Data N/A'}</div>
                            </div>
                        </div>

                        <!-- Data Grid -->
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <!-- Demografia -->
                            <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                                <h5 class="text-[10px] font-black uppercase text-slate-400 mb-2">1. Perfil Demográfico</h5>
                                <div class="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                                    <p><span class="font-normal opacity-70">Idade:</span> ${u.idade ? u.idade + ' anos' : 'N/A'}</p>
                                    <p><span class="font-normal opacity-70">Gênero:</span> ${u.genero || 'N/A'}</p>
                                    <p><span class="font-normal opacity-70">Vínculo:</span> ${u.vinculo || 'N/A'}</p>
                                    <p><span class="font-normal opacity-70">Exp. Prévia:</span> ${u.experiencia_previa || 'N/A'}</p>
                                </div>
                            </div>

                            <!-- Notas Testes -->
                            <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                                <h5 class="text-[10px] font-black uppercase text-slate-400 mb-2">2. Conhecimento Teórico</h5>
                                <div class="space-y-1.5 text-xs">
                                    <p class="text-amber-600 dark:text-amber-500 font-bold"><span class="font-normal text-slate-700 dark:text-slate-300 opacity-70">Pré-Teste:</span> ${preText}</p>
                                    <p class="text-rose-600 dark:text-rose-400 font-bold"><span class="font-normal text-slate-700 dark:text-slate-300 opacity-70">Pós-Teste:</span> ${postText}</p>
                                    <p class="${evolutionClass} font-bold"><span class="font-normal text-slate-700 dark:text-slate-300 opacity-70">Evolução:</span> ${evolutionText}</p>
                                </div>
                            </div>

                            <!-- Autoeficácia -->
                            <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 md:col-span-2">
                                <h5 class="text-[10px] font-black uppercase text-slate-400 mb-2">3. Autoeficácia (Médias: Pré ${preEffAvg} | Pós ${postEffAvg})</h5>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px]">
                                    <div class="space-y-1">
                                        <div class="font-black text-blue-750 dark:text-blue-400">PRÉ-TREINO:</div>
                                        <div class="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-600 dark:text-slate-400">${preEffList}</div>
                                    </div>
                                    <div class="space-y-1">
                                        <div class="font-black text-rose-750 dark:text-rose-400">PÓS-TREINO:</div>
                                        <div class="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-600 dark:text-slate-400">${postEffList}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Usabilidade & Comentários -->
                        <div class="mt-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="md:col-span-1">
                                <h5 class="text-[10px] font-black uppercase text-slate-400 mb-2">4. Usabilidade SUS (Média: ${uxAvg})</h5>
                                <div class="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                                    ${uxList}
                                </div>
                            </div>
                            <div class="md:col-span-2">
                                <h5 class="text-[10px] font-black uppercase text-slate-400 mb-2">5. Sugestões e Comentários</h5>
                                <p class="text-xs italic text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-850 min-h-[40px]">
                                    "${u.ux && u.ux.suggestions ? u.ux.suggestions : 'Nenhuma sugestão enviada.'}"
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
};

window.renderDeveloperTable = (users) => {
    const container = document.getElementById('developer-table-container');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-500 dark:text-slate-400">
                <p class="text-lg font-bold">Nenhum participante encontrado</p>
                <p class="text-xs">Tente ajustar seus filtros de busca.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="w-full text-left border-collapse min-w-[1000px]">
            <thead>
                <tr class="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">
                    <th class="p-6">Participante</th>
                    <th class="p-6">Setor / Vínculo</th>
                    <th class="p-6">Pré-Teste</th>
                    <th class="p-6">Pós-Teste</th>
                    <th class="p-6">Evolução</th>
                    <th class="p-6">Confiança Pré</th>
                    <th class="p-6">Confiança Pós</th>
                    <th class="p-6">Aproveitamento UX</th>
                    <th class="p-6 text-center">Ficha</th>
                </tr>
            </thead>
            <tbody class="text-xs font-bold text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                ${users.map((u, i) => {
                    const dispId = u.user_id.startsWith('anon-') ? `Anon (${u.user_id.slice(-6)})` : u.user_id;
                    const preText = u.pre_test ? `${u.pre_test.percent}% (${u.pre_test.score}/${u.pre_test.total})` : "—";
                    const postText = u.post_test ? `${u.post_test.percent}% (${u.post_test.score}/${u.post_test.total})` : "—";
                    
                    let evolutionText = "—";
                    let evolutionClass = "text-purple-600 dark:text-purple-400";
                    if (u.pre_test && u.post_test && typeof u.pre_test.percent === 'number' && typeof u.post_test.percent === 'number') {
                        const diff = u.post_test.percent - u.pre_test.percent;
                        evolutionText = `${diff >= 0 ? '+' : ''}${diff}%`;
                        if (diff > 0) {
                            evolutionClass = "text-emerald-600 dark:text-emerald-500";
                        } else if (diff < 0) {
                            evolutionClass = "text-rose-600 dark:text-rose-455";
                        } else {
                            evolutionClass = "text-slate-500 dark:text-slate-400";
                        }
                    }

                    // Self efficacy scores averages
                    const preEffVals = Object.values(u.pre_efficacy).filter(v => typeof v === 'number');
                    const preEffAvg = preEffVals.length > 0 ? (preEffVals.reduce((a,b)=>a+b, 0) / preEffVals.length).toFixed(1) : "—";
                    
                    const postEffVals = Object.values(u.post_efficacy).filter(v => typeof v === 'number');
                    const postEffAvg = postEffVals.length > 0 ? (postEffVals.reduce((a,b)=>a+b, 0) / postEffVals.length).toFixed(1) : "—";
                    
                    // UX SUS average
                    const uxAvg = u.ux ? (((u.ux.ux1 || 0) + (u.ux.ux2 || 0) + (u.ux.ux3 || 0) + (u.ux.ux4 || 0) + (u.ux.ux5 || 0)) / 5).toFixed(1) : "—";

                    return `
                        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                            <td class="p-6">
                                <div class="font-black text-slate-900 dark:text-white">${dispId}</div>
                                <div class="text-[9px] font-normal text-slate-400 mt-0.5">${u.idade ? u.idade + ' anos' : 'Idade N/A'} • ${u.genero || 'Gênero N/A'}</div>
                            </td>
                            <td class="p-6">
                                <div class="font-black text-blue-700 dark:text-blue-400 uppercase text-[10px]">${u.setor || 'N/A'}</div>
                                <div class="text-[9px] font-normal text-slate-400 mt-0.5">${u.vinculo || 'Vínculo N/A'}</div>
                            </td>
                            <td class="p-6 text-amber-600 dark:text-amber-500">${preText}</td>
                            <td class="p-6 text-rose-600 dark:text-rose-400">${postText}</td>
                            <td class="p-6 ${evolutionClass}">${evolutionText}</td>
                            <td class="p-6">${preEffAvg}</td>
                            <td class="p-6">${postEffAvg}</td>
                            <td class="p-6 text-emerald-600 dark:text-emerald-500">${uxAvg}</td>
                            <td class="p-6 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button onclick="window.showDevDetails('${u.user_id}')" class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 p-2 px-3 rounded-lg hover:bg-blue-100 transition-all text-xs font-bold">
                                        Visualizar
                                    </button>
                                    <button onclick="window.deleteUserRecord('${u.user_id}')" class="bg-rose-50 dark:bg-rose-950/30 text-rose-650 dark:text-rose-455 p-2 px-3 rounded-lg hover:bg-rose-100 transition-all text-xs font-bold">
                                        Excluir
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
};

window.renderDeveloperStats = (users) => {
    const container = document.getElementById('developer-table-container');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-500 dark:text-slate-400">
                <p class="text-lg font-bold">Nenhum participante encontrado</p>
                <p class="text-xs">Tente ajustar seus filtros de busca.</p>
            </div>
        `;
        return;
    }

    const aggregateBy = (keyName, getGroupVal) => {
        const groups = {};
        users.forEach(u => {
            let val = getGroupVal(u);
            if (val === undefined || val === null || val.trim() === "") val = "Não Informado";
            if (!groups[val]) {
                groups[val] = {
                    name: val,
                    count: 0,
                    preSum: 0, preCount: 0,
                    postSum: 0, postCount: 0,
                    effPreSum: 0, effPreCount: 0,
                    effPostSum: 0, effPostCount: 0,
                    susSum: 0, susCount: 0
                };
            }
            const g = groups[val];
            g.count++;
            
            // Quiz
            if (u.pre_test && typeof u.pre_test.percent === 'number') {
                g.preSum += u.pre_test.percent;
                g.preCount++;
            }
            if (u.post_test && typeof u.post_test.percent === 'number') {
                g.postSum += u.post_test.percent;
                g.postCount++;
            }
            
            // Autoeficácia Pré
            if (u.pre_efficacy) {
                Object.values(u.pre_efficacy).forEach(val => {
                    if (typeof val === 'number') {
                        g.effPreSum += val;
                        g.effPreCount++;
                    }
                });
            }
            // Autoeficácia Pós
            if (u.post_efficacy) {
                Object.values(u.post_efficacy).forEach(val => {
                    if (typeof val === 'number') {
                        g.effPostSum += val;
                        g.effPostCount++;
                    }
                });
            }
            
            // Usabilidade SUS
            if (u.ux) {
                const susVals = [u.ux.ux1, u.ux.ux2, u.ux.ux3, u.ux.ux4, u.ux.ux5].filter(v => typeof v === 'number');
                if (susVals.length > 0) {
                    g.susSum += susVals.reduce((a,b)=>a+b, 0) / susVals.length;
                    g.susCount++;
                }
            }
        });
        
        return Object.values(groups).map(g => {
            const preAvg = g.preCount > 0 ? Math.round(g.preSum / g.preCount) : null;
            const postAvg = g.postCount > 0 ? Math.round(g.postSum / g.postCount) : null;
            const gain = (preAvg !== null && postAvg !== null) ? (postAvg - preAvg) : null;
            const effPreAvg = g.effPreCount > 0 ? (g.effPreSum / g.effPreCount).toFixed(2) : "—";
            const effPostAvg = g.effPostCount > 0 ? (g.effPostSum / g.effPostCount).toFixed(2) : "—";
            const susAvg = g.susCount > 0 ? (g.susSum / g.susCount).toFixed(2) : "—";
            
            return {
                name: g.name,
                count: g.count,
                preAvg: preAvg !== null ? `${preAvg}%` : "—",
                postAvg: postAvg !== null ? `${postAvg}%` : "—",
                gain: gain !== null ? `${gain >= 0 ? '+' : ''}${gain}%` : "—",
                effPreAvg,
                effPostAvg,
                susAvg
            };
        });
    };

    const sectorStats = aggregateBy("Setor", u => u.setor);
    const expStats = aggregateBy("Experiência Prévia", u => u.experiencia_previa);

    const getTableHTML = (title, stats) => {
        let totalN = 0;
        let preSum = 0, preCount = 0;
        let postSum = 0, postCount = 0;
        let effPreSum = 0, effPreCount = 0;
        let effPostSum = 0, effPostCount = 0;
        let susSum = 0, susCount = 0;
        
        stats.forEach(s => totalN += s.count);
        
        users.forEach(u => {
            if (u.pre_test && typeof u.pre_test.percent === 'number') {
                preSum += u.pre_test.percent;
                preCount++;
            }
            if (u.post_test && typeof u.post_test.percent === 'number') {
                postSum += u.post_test.percent;
                postCount++;
            }
            if (u.pre_efficacy) {
                Object.values(u.pre_efficacy).forEach(val => {
                    if (typeof val === 'number') { effPreSum += val; effPreCount++; }
                });
            }
            if (u.post_efficacy) {
                Object.values(u.post_efficacy).forEach(val => {
                    if (typeof val === 'number') { effPostSum += val; effPostCount++; }
                });
            }
            if (u.ux) {
                const susVals = [u.ux.ux1, u.ux.ux2, u.ux.ux3, u.ux.ux4, u.ux.ux5].filter(v => typeof v === 'number');
                if (susVals.length > 0) {
                    susSum += susVals.reduce((a,b)=>a+b, 0) / susVals.length;
                    susCount++;
                }
            }
        });
        
        const totalPreAvg = preCount > 0 ? `${Math.round(preSum / preCount)}%` : "—";
        const totalPostAvg = postCount > 0 ? `${Math.round(postSum / postCount)}%` : "—";
        const totalGainVal = (preCount > 0 && postCount > 0) ? (Math.round(postSum / postCount) - Math.round(preSum / preCount)) : null;
        const totalGain = totalGainVal !== null ? `${totalGainVal >= 0 ? '+' : ''}${totalGainVal}%` : "—";
        const totalEffPreAvg = effPreCount > 0 ? (effPreSum / effPreCount).toFixed(2) : "—";
        const totalEffPostAvg = effPostCount > 0 ? (effPostSum / effPostCount).toFixed(2) : "—";
        const totalSusAvg = susCount > 0 ? (susSum / susCount).toFixed(2) : "—";

        return `
            <div class="p-6 lg:p-8 space-y-4">
                <h4 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-wide border-b pb-3 border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span>${title}</span>
                </h4>
                <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-50/50 dark:bg-slate-900/20">
                    <table class="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr class="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">
                                <th class="p-4 pl-6">Grupo / Categoria</th>
                                <th class="p-4 text-center">N (Amostra)</th>
                                <th class="p-4 text-center">Média Pré</th>
                                <th class="p-4 text-center">Média Pós</th>
                                <th class="p-4 text-center">Ganho Teórico</th>
                                <th class="p-4 text-center">Confiança Pré (1-5)</th>
                                <th class="p-4 text-center">Confiança Pós (1-5)</th>
                                <th class="p-4 text-center">Usabilidade SUS (1-5)</th>
                            </tr>
                        </thead>
                        <tbody class="text-xs font-bold text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                            ${stats.map(s => {
                                let gainClass = "text-purple-600 dark:text-purple-400";
                                if (s.gain !== "—") {
                                    const gNum = parseFloat(s.gain);
                                    if (gNum > 0) gainClass = "text-emerald-600 dark:text-emerald-500";
                                    else if (gNum < 0) gainClass = "text-rose-600 dark:text-rose-455";
                                }
                                return `
                                    <tr class="hover:bg-white dark:hover:bg-slate-900/40 transition-all">
                                        <td class="p-4 pl-6 font-black text-slate-900 dark:text-white">${s.name}</td>
                                        <td class="p-4 text-center font-normal text-slate-500">${s.count}</td>
                                        <td class="p-4 text-center text-amber-600 dark:text-amber-500">${s.preAvg}</td>
                                        <td class="p-4 text-center text-rose-600 dark:text-rose-400">${s.postAvg}</td>
                                        <td class="p-4 text-center ${gainClass}">${s.gain}</td>
                                        <td class="p-4 text-center text-blue-600 dark:text-blue-400">${s.effPreAvg}</td>
                                        <td class="p-4 text-center text-rose-700 dark:text-rose-400">${s.effPostAvg}</td>
                                        <td class="p-4 text-center text-emerald-600 dark:text-emerald-500">${s.susAvg}</td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr class="bg-slate-100/50 dark:bg-slate-800/40 font-black border-t-2 border-slate-200 dark:border-slate-700">
                                <td class="p-4 pl-6 text-slate-900 dark:text-white uppercase tracking-wider">TOTAL GERAL (Média)</td>
                                <td class="p-4 text-center text-slate-900 dark:text-white font-black">${totalN}</td>
                                <td class="p-4 text-center text-amber-600 dark:text-amber-500">${totalPreAvg}</td>
                                <td class="p-4 text-center text-rose-600 dark:text-rose-400">${totalPostAvg}</td>
                                <td class="p-4 text-center ${totalGainVal >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-455'}">${totalGain}</td>
                                <td class="p-4 text-center text-blue-600 dark:text-blue-400">${totalEffPreAvg}</td>
                                <td class="p-4 text-center text-rose-700 dark:text-rose-400">${totalEffPostAvg}</td>
                                <td class="p-4 text-center text-emerald-600 dark:text-emerald-500">${totalSusAvg}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl">
            ${getTableHTML("1. Análise Estatística por Setor Assistencial / Administrativo", sectorStats)}
            ${getTableHTML("2. Análise Estatística por Experiência Prévia em SBV", expStats)}
        </div>
    `;
};

window.filterDeveloperData = () => {
    const searchVal = document.getElementById('dev-filter-search')?.value.toLowerCase() || "";
    const sectorVal = document.getElementById('dev-filter-sector')?.value || "";
    const expVal = document.getElementById('dev-filter-exp')?.value || "";

    const filtered = window.allDeveloperUsers.filter(u => {
        const matchesSearch = u.user_id.toLowerCase().includes(searchVal) ||
            (u.setor || "").toLowerCase().includes(searchVal) ||
            (u.genero || "").toLowerCase().includes(searchVal);
            
        const matchesSector = sectorVal === "" || u.setor === sectorVal;
        const matchesExp = expVal === "" || u.experiencia_previa === expVal;
        
        return matchesSearch && matchesSector && matchesExp;
    });

    window.currentDevUsers = filtered;
    window.renderDeveloperData(filtered);
    window.renderDeveloperMetrics(filtered);
};

window.exportDeveloperCSV = () => {
    if (!window.currentDevUsers || window.currentDevUsers.length === 0) {
        alert("Nenhum dado disponível para exportar.");
        return;
    }

    const headers = [
        "ID Usuario", "Data Registro",
        "Idade", "Genero", "Setor", "Vinculo", "Experiencia Previa",
        "Pre-Teste Acertos", "Pre-Teste Total", "Pre-Teste Porcentagem (0-100)",
        "Pos-Teste Acertos", "Pos-Teste Total", "Pos-Teste Porcentagem (0-100)",
        "Evolucao Notas (Pos - Pre)",
        "Autoeficacia Pre Q1", "Autoeficacia Pre Q2", "Autoeficacia Pre Q3", "Autoeficacia Pre Q4",
        "Autoeficacia Pre Media (1-5)",
        "Autoeficacia Pos Q1", "Autoeficacia Pos Q2", "Autoeficacia Pos Q3", "Autoeficacia Pos Q4",
        "Autoeficacia Pos Media (1-5)",
        "Evolucao Autoeficacia (Pos - Pre)",
        "UX SUS Q1", "UX SUS Q2", "UX SUS Q3", "UX SUS Q4", "UX SUS Q5",
        "Usabilidade SUS Media (1-5)",
        "Sugestoes"
    ];

    const rows = window.currentDevUsers.map(u => {
        const prePct = (u.pre_test && typeof u.pre_test.percent === 'number') ? u.pre_test.percent : "";
        const postPct = (u.post_test && typeof u.post_test.percent === 'number') ? u.post_test.percent : "";
        const diffQuiz = (prePct !== "" && postPct !== "") ? (postPct - prePct) : "";

        const effPreVals = [1,2,3,4].map(idx => u.pre_efficacy[idx]).filter(v => typeof v === 'number');
        const effPreAvg = effPreVals.length > 0 ? (effPreVals.reduce((a,b)=>a+b,0) / effPreVals.length) : null;
        
        const effPostVals = [1,2,3,4].map(idx => u.post_efficacy[idx]).filter(v => typeof v === 'number');
        const effPostAvg = effPostVals.length > 0 ? (effPostVals.reduce((a,b)=>a+b,0) / effPostVals.length) : null;
        
        const diffEff = (effPreAvg !== null && effPostAvg !== null) ? (effPostAvg - effPreAvg) : null;

        let uxAvg = null;
        if (u.ux) {
            const uxVals = [u.ux.ux1, u.ux.ux2, u.ux.ux3, u.ux.ux4, u.ux.ux5].filter(v => typeof v === 'number');
            if (uxVals.length > 0) {
                uxAvg = uxVals.reduce((a,b)=>a+b, 0) / uxVals.length;
            }
        }

        const fmtDec = (val) => {
            if (val === null || val === undefined || isNaN(val)) return "";
            return val.toFixed(2).replace('.', ',');
        };

        return [
            u.user_id || "",
            u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : "",
            u.idade || "",
            u.genero || "",
            u.setor || "",
            u.vinculo || "",
            u.experiencia_previa || "",
            u.pre_test?.score ?? "",
            u.pre_test?.total ?? "",
            prePct,
            u.post_test?.score ?? "",
            u.post_test?.total ?? "",
            postPct,
            diffQuiz,
            (u.pre_efficacy[1] !== undefined && u.pre_efficacy[1] !== null) ? u.pre_efficacy[1] : "",
            (u.pre_efficacy[2] !== undefined && u.pre_efficacy[2] !== null) ? u.pre_efficacy[2] : "",
            (u.pre_efficacy[3] !== undefined && u.pre_efficacy[3] !== null) ? u.pre_efficacy[3] : "",
            (u.pre_efficacy[4] !== undefined && u.pre_efficacy[4] !== null) ? u.pre_efficacy[4] : "",
            fmtDec(effPreAvg),
            (u.post_efficacy[1] !== undefined && u.post_efficacy[1] !== null) ? u.post_efficacy[1] : "",
            (u.post_efficacy[2] !== undefined && u.post_efficacy[2] !== null) ? u.post_efficacy[2] : "",
            (u.post_efficacy[3] !== undefined && u.post_efficacy[3] !== null) ? u.post_efficacy[3] : "",
            (u.post_efficacy[4] !== undefined && u.post_efficacy[4] !== null) ? u.post_efficacy[4] : "",
            fmtDec(effPostAvg),
            fmtDec(diffEff),
            (u.ux?.ux1 !== undefined && u.ux?.ux1 !== null) ? u.ux.ux1 : "",
            (u.ux?.ux2 !== undefined && u.ux?.ux2 !== null) ? u.ux.ux2 : "",
            (u.ux?.ux3 !== undefined && u.ux?.ux3 !== null) ? u.ux.ux3 : "",
            (u.ux?.ux4 !== undefined && u.ux?.ux4 !== null) ? u.ux.ux4 : "",
            (u.ux?.ux5 !== undefined && u.ux?.ux5 !== null) ? u.ux.ux5 : "",
            fmtDec(uxAvg),
            `"${(u.ux?.suggestions || "").replace(/"/g, '""')}"`
        ];
    });

    // Padrão brasileiro de CSV (ponto e vírgula e BOM)
    let csvContent = "\uFEFF";
    csvContent += headers.join(";") + "\n";
    csvContent += rows.map(r => r.join(";")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_pesquisa_sbv_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.showDevDetails = (userId) => {
    const user = window.allDeveloperUsers.find(u => u.user_id === userId);
    if (!user) return;

    const modal = document.getElementById('dev-details-modal');
    const labelId = document.getElementById('dev-detail-userid');
    const content = document.getElementById('dev-detail-content');

    if (modal && labelId && content) {
        labelId.innerText = `Sessão ID: ${user.user_id}`;
        
        let evolutionText = "—";
        let evolutionClass = "text-purple-650 dark:text-purple-400";
        if (user.pre_test && user.post_test && typeof user.pre_test.percent === 'number' && typeof user.post_test.percent === 'number') {
            const diff = user.post_test.percent - user.pre_test.percent;
            evolutionText = `${diff >= 0 ? '+' : ''}${diff}%`;
            if (diff > 0) {
                evolutionClass = "text-emerald-600 dark:text-emerald-500";
            } else if (diff < 0) {
                evolutionClass = "text-rose-600 dark:text-rose-455";
            } else {
                evolutionClass = "text-slate-500 dark:text-slate-400";
            }
        }
        
        // Build detail content
        const preEffList = [1,2,3,4].map(idx => `<div class="flex justify-between border-b pb-2"><span>Questão ${idx}:</span><span class="font-black text-blue-700">${(user.pre_efficacy[idx] !== undefined && user.pre_efficacy[idx] !== null) ? user.pre_efficacy[idx] : '—'} / 5</span></div>`).join('');
        const postEffList = [1,2,3,4].map(idx => `<div class="flex justify-between border-b pb-2"><span>Questão ${idx}:</span><span class="font-black text-rose-700">${(user.post_efficacy[idx] !== undefined && user.post_efficacy[idx] !== null) ? user.post_efficacy[idx] : '—'} / 5</span></div>`).join('');
        const uxList = [1,2,3,4,5].map(idx => `<div class="flex justify-between border-b pb-2"><span>Escore UX ${idx}:</span><span class="font-black text-emerald-700">${(user.ux && user.ux[`ux${idx}`] !== undefined && user.ux[`ux${idx}`] !== null) ? user.ux[`ux${idx}`] : '—'} / 5</span></div>`).join('');

        content.innerHTML = `
            <div class="grid md:grid-cols-2 gap-6">
                <!-- Coluna 1: Demografia e Testes -->
                <div class="space-y-6 flex-1">
                    <div class="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700">
                        <h4 class="font-black text-sm uppercase text-slate-500 mb-3">1. Perfil Demográfico</h4>
                        <div class="space-y-2 text-xs">
                            <p><strong>Idade:</strong> ${user.idade ? user.idade + ' anos' : 'Não Informado'}</p>
                            <p><strong>Gênero:</strong> ${user.genero || 'Não Informado'}</p>
                            <p><strong>Setor:</strong> ${user.setor || 'Não Informado'}</p>
                            <p><strong>Vínculo:</strong> ${user.vinculo || 'Não Informado'}</p>
                            <p><strong>Experiência Prévia:</strong> ${user.experiencia_previa || 'Não Informado'}</p>
                            <p><strong>Data de Entrada:</strong> ${user.created_at ? new Date(user.created_at).toLocaleString('pt-BR') : 'N/A'}</p>
                        </div>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700">
                        <h4 class="font-black text-sm uppercase text-slate-500 mb-3">2. Conhecimento Teórico (Quiz)</h4>
                        <div class="space-y-2 text-xs">
                            <p><strong>Pré-Teste (Baseline):</strong> ${user.pre_test ? `${user.pre_test.percent}% (${user.pre_test.score}/${user.pre_test.total})` : 'Não realizado'}</p>
                            <p><strong>Pós-Teste (Exame Final):</strong> ${user.post_test ? `${user.post_test.percent}% (${user.post_test.score}/${user.post_test.total})` : 'Não realizado'}</p>
                            <p><strong>Evolução:</strong> <span class="${evolutionClass} font-bold">${evolutionText}</span></p>
                        </div>
                    </div>
                </div>

                <!-- Coluna 2: Autoeficácia e UX -->
                <div class="space-y-6 flex-1">
                    <div class="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700">
                        <h4 class="font-black text-sm uppercase text-slate-500 mb-3">3. Autoeficácia Pré-Treino</h4>
                        <div class="space-y-2 text-xs">
                            ${preEffList}
                        </div>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700">
                        <h4 class="font-black text-sm uppercase text-slate-500 mb-3">4. Autoeficácia Pós-Treino</h4>
                        <div class="space-y-2 text-xs">
                            ${postEffList}
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 w-full mt-6">
                <h4 class="font-black text-sm uppercase text-slate-500 mb-3">5. Escala de Usabilidade (UX/SUS)</h4>
                <div class="grid md:grid-cols-2 gap-6 text-xs">
                    <div class="space-y-2">
                        ${uxList}
                    </div>
                    <div class="space-y-2">
                        <p class="font-bold">Sugestões e Comentários:</p>
                        <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-850 italic min-h-[80px] text-xs">
                            ${user.ux && user.ux.suggestions ? user.ux.suggestions : 'Nenhuma sugestão enviada.'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.deleteUserRecord = async (userId) => {
    if (!confirm(`Deseja realmente excluir permanentemente o participante com ID "${userId}"? Isto apagará todas as respostas de testes, autoeficácia e usabilidade deste usuário do banco de dados.`)) {
        return;
    }

    try {
        const [
            { error: errPart },
            { error: errQuiz },
            { error: errEff },
            { error: errUx }
        ] = await Promise.all([
            window.supabaseClient.from('participantes').delete().eq('user_id', userId),
            window.supabaseClient.from('quiz_attempts').delete().eq('user_id', userId),
            window.supabaseClient.from('autoeficacia_usabilidade').delete().eq('user_id', userId),
            window.supabaseClient.from('ux_evaluation').delete().eq('user_id', userId)
        ]);

        if (errPart || errQuiz || errEff || errUx) {
            console.error("Erro ao deletar registro:", { errPart, errQuiz, errEff, errUx });
            alert("Erro ao excluir do Supabase. Verifique se as políticas de exclusão (DELETE) foram habilitadas no console do Supabase.");
            return;
        }

        alert("Participante excluído com sucesso!");
        window.loadDeveloperData();
    } catch (e) {
        console.error("Exceção ao deletar registro:", e);
        alert("Ocorreu um erro inesperado ao excluir o registro.");
    }
};

window.closeDevDetailsModal = () => {
    const modal = document.getElementById('dev-details-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// Verifica na inicialização se há o parâmetro ?dev na URL
if (new URLSearchParams(window.location.search).has('dev')) {
    setTimeout(() => {
        const password = prompt("Digite a senha de desenvolvedor para acessar o painel:");
        if (password === "tccdev2026") {
            window.showView('developer');
        } else if (password !== null) {
            alert("Senha incorreta!");
        }
    }, 800);
}

// Impedir fechamento acidental da página antes de concluir o pós-teste
window.addEventListener('beforeunload', (e) => {
    const hasTCLE = localStorage.getItem('study_tcle_accepted') === 'true';
    const hasPostTest = localStorage.getItem('study_final_test_done') === 'true';
    const isDev = localStorage.getItem('is_dev_user') === 'true';
    
    if (hasTCLE && !hasPostTest && !isDev) {
        e.preventDefault();
        e.returnValue = 'Realize o pós-teste para validar suas informações e ajudar no projeto de pesquisa.';
        return e.returnValue;
    }
});
