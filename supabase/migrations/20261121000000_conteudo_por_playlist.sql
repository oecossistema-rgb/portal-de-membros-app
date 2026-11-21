-- Conteúdo: só entra o que está nas playlists "Portal" do YouTube (a playlist define a categoria).
alter table public.conteudos add column if not exists playlist_id text;
