-- ============================================================
-- Skills Jurídicas com IA — Setup do banco de dados
-- Executar no SQL Editor do Supabase (produção)
-- ============================================================

-- Tabela de acessos (quem comprou qual área)
create table if not exists skills_purchases (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  area text not null, -- 'trabalhista', 'civel', 'penal', etc. 'all' = pack completo
  cakto_order_id text,
  created_at timestamptz default now()
);

-- Índice de busca por email
create index if not exists idx_skills_purchases_email on skills_purchases(email);

-- Tabela de conteúdo das skills
create table if not exists skills_content (
  id uuid default gen_random_uuid() primary key,
  area text not null,
  numero int not null,
  nome text not null,
  descricao text,
  quando_usar text,
  prompt text not null,
  dicas text,
  unique(area, numero)
);

-- Índice de busca por área
create index if not exists idx_skills_content_area on skills_content(area);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table skills_purchases enable row level security;
alter table skills_content enable row level security;

-- Qualquer um pode ler skills_content (o controle de acesso é feito no frontend)
create policy "skills_content_public_read"
  on skills_content for select
  using (true);

-- skills_purchases: usuário só vê os próprios registros
create policy "skills_purchases_own"
  on skills_purchases for select
  using (auth.jwt() ->> 'email' = email);

-- ============================================================
-- Habilitar autenticação por magic link
-- (Configurar no Dashboard > Authentication > Providers > Email)
-- Marcar: Enable Email provider
-- Desmarcar: Confirm email (para magic link funcionar sem confirmação)
-- ============================================================
