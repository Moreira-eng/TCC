// CONFIGURAÇÃO SUPABASE REAL - TCC SBV
const SUPABASE_URL = "https://rvwdpdcmotntflspxlxk.supabase.co";
const SUPABASE_KEY = "sb_publishable_7K-_bKLN4zNkeSOkd1tvpQ_gKGe4lAc";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabaseClient = supabaseClient;
console.log("[Supabase] Cliente inicializado com sucesso.");

// Gerenciamento de Sessão de Pesquisa (Anônima e Persistente)
async function getSession() {
    // Tenta pegar o ID do usuário local ou do Supabase Auth
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session && session.user) {
        return { user: session.user };
    }

    let userId = localStorage.getItem('tcc_user_id');
    if (!userId) {
        userId = 'anon-' + crypto.randomUUID();
        localStorage.setItem('tcc_user_id', userId);
    }
    return { user: { id: userId, is_anon: true } };
}

window.getSession = getSession;

// Funções Utilitárias de Persistência
window.db = {
    async insert(table, data) {
        console.log(`[Supabase] Inserindo em ${table}:`, data);
        const { data: result, error } = await window.supabaseClient.from(table).insert(data);
        if (error) {
            console.error(`[Supabase] Erro em ${table}:`, error.message);
            // Fallback para localStorage em caso de erro de conexão
            this.fallbackSave(table, data);
            return { error };
        }
        console.log(`[Supabase] Sucesso em ${table}`);
        return { data: result, error: null };
    },

    fallbackSave(table, data) {
        const key = `fallback_${table}`;
        let pending = JSON.parse(localStorage.getItem(key)) || [];
        pending.push({ ...data, pending_sync: true, sync_date: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(pending));
    },

    async exportTCCData() {
        alert("Para exportar os dados reais, utilize o Dashboard do Supabase (Export CSV) para garantir a integridade total dos dados de todos os participantes.");
    }
};
