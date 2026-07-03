-- =========================================================================
-- SCRIPT DE BANCO DE DADOS SUPABASE - PESQUISA SBV
-- ATENÇÃO: Executar este script irá recriar as tabelas do zero.
-- Caso queira zerar seu banco de dados e começar limpo, use a seção abaixo.
-- =========================================================================

-- Para resetar completamente o banco de dados (CUIDADO: apaga dados existentes):
-- DROP TABLE IF EXISTS certificacao, ux_evaluation, autoeficacia_usabilidade, quiz_attempts, participantes CASCADE;

-- 1. TABELA DE PARTICIPANTES (DADOS SOCIODEMOGRÁFICOS)
CREATE TABLE IF NOT EXISTS participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id TEXT UNIQUE, -- ID local único gerado
    idade INTEGER,
    genero TEXT,
    setor TEXT,
    vinculo TEXT,
    experiencia_previa TEXT
);

-- 2. TABELA DE RESULTADOS DE TESTES (PRÉ E PÓS-TESTE)
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id TEXT,
    type TEXT, -- 'pre_teste', 'avaliacao_final'
    score INTEGER, -- número de acertos
    total INTEGER, -- total de questões
    percent INTEGER, -- porcentagem final (0-100)
    passed BOOLEAN,
    date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. TABELA DE AUTOEFICÁCIA E CONFIANÇA
CREATE TABLE IF NOT EXISTS autoeficacia_usabilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id TEXT,
    fase TEXT, -- 'pre' ou 'pos'
    pergunta_id INTEGER,
    valor INTEGER -- nota de 1 a 5
);

-- 4. TABELA DE USABILIDADE (UX) - RESPOSTAS DA ESCALA SUS/UX
CREATE TABLE IF NOT EXISTS ux_evaluation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id TEXT,
    ux1 INTEGER,
    ux2 INTEGER,
    ux3 INTEGER,
    ux4 INTEGER,
    ux5 INTEGER,
    suggestions TEXT
);

-- 5. TABELA DE CERTIFICAÇÃO (OPCIONAL/HISTÓRICO)
CREATE TABLE IF NOT EXISTS certificacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id TEXT,
    nome_completo TEXT,
    cpf TEXT,
    instituicao TEXT,
    percent_final INTEGER
);

-- =========================================================================
-- CONFIGURAÇÃO DE POLÍTICAS DE SEGURANÇA (RLS)
-- Habilita segurança de linha e permite inserção, leitura e exclusão pública
-- =========================================================================

-- Tabela: participantes
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert" ON participantes;
DROP POLICY IF EXISTS "Allow public select" ON participantes;
DROP POLICY IF EXISTS "Allow public delete" ON participantes;
CREATE POLICY "Allow public insert" ON participantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON participantes FOR SELECT USING (true);
CREATE POLICY "Allow public delete" ON participantes FOR DELETE USING (true);

-- Tabela: quiz_attempts
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert" ON quiz_attempts;
DROP POLICY IF EXISTS "Allow public select" ON quiz_attempts;
DROP POLICY IF EXISTS "Allow public delete" ON quiz_attempts;
CREATE POLICY "Allow public insert" ON quiz_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON quiz_attempts FOR SELECT USING (true);
CREATE POLICY "Allow public delete" ON quiz_attempts FOR DELETE USING (true);

-- Tabela: autoeficacia_usabilidade
ALTER TABLE autoeficacia_usabilidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert" ON autoeficacia_usabilidade;
DROP POLICY IF EXISTS "Allow public select" ON autoeficacia_usabilidade;
DROP POLICY IF EXISTS "Allow public delete" ON autoeficacia_usabilidade;
CREATE POLICY "Allow public insert" ON autoeficacia_usabilidade FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON autoeficacia_usabilidade FOR SELECT USING (true);
CREATE POLICY "Allow public delete" ON autoeficacia_usabilidade FOR DELETE USING (true);

-- Tabela: ux_evaluation
ALTER TABLE ux_evaluation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert" ON ux_evaluation;
DROP POLICY IF EXISTS "Allow public select" ON ux_evaluation;
DROP POLICY IF EXISTS "Allow public delete" ON ux_evaluation;
CREATE POLICY "Allow public insert" ON ux_evaluation FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON ux_evaluation FOR SELECT USING (true);
CREATE POLICY "Allow public delete" ON ux_evaluation FOR DELETE USING (true);

-- Tabela: certificacao
ALTER TABLE certificacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert" ON certificacao;
DROP POLICY IF EXISTS "Allow public select" ON certificacao;
DROP POLICY IF EXISTS "Allow public delete" ON certificacao;
CREATE POLICY "Allow public insert" ON certificacao FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON certificacao FOR SELECT USING (true);
CREATE POLICY "Allow public delete" ON certificacao FOR DELETE USING (true);
