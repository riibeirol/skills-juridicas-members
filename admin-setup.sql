-- ============================================================
-- Policies de admin para a tabela skills_purchases
-- Executar no SQL Editor do Supabase (projeto de teste ou produção)
-- ============================================================

-- Policy para admin ler todos os registros
create policy "skills_purchases_admin_read"
  on skills_purchases for select
  using (auth.jwt() ->> 'email' = 'leonardo@rsabr.adv.br');

-- Policy para admin inserir
create policy "skills_purchases_admin_insert"
  on skills_purchases for insert
  with check (auth.jwt() ->> 'email' = 'leonardo@rsabr.adv.br');

-- Policy para admin deletar
create policy "skills_purchases_admin_delete"
  on skills_purchases for delete
  using (auth.jwt() ->> 'email' = 'leonardo@rsabr.adv.br');
