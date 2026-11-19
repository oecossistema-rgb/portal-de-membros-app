-- GALERIA DE FOTOS E VÍDEOS DOS EVENTOS (19/11/2026)
-- Cada evento pode ter um local e uma galeria que aponta para pastas do Google Drive
-- (compartilhadas por link). Nada é copiado para os nossos servidores: o portal mostra as pastas do Drive.
-- Formato da galeria: {"pasta": "<id da pasta principal>", "dias": [{"titulo": "Dia 1", "pastas": [{"nome": "Brenda", "id": "<id>"}]}]}
alter table public.eventos add column if not exists local text;
alter table public.eventos add column if not exists galeria jsonb;

update public.eventos set local = 'Morro de São Paulo', galeria = '{
  "pasta": "16g7u2-FWAus5sZdlqfWUIqn0IU9lfImE",
  "dias": [
    {"titulo": "Dia 1", "pastas": [{"nome": "Brenda", "id": "1uoFetFLiCyL9CQ7WFKX7C63yTilWPIaV"}, {"nome": "Marcos", "id": "1AslWfZ_aM2fqUCYzwP1ISOfA9lMCQFFI"}]},
    {"titulo": "Dia 2", "pastas": [{"nome": "Brenda", "id": "1D-zr0RLKcnJR-3DlTXQKbZUzOhbWYC0P"}, {"nome": "Júlia", "id": "1w-CyGDfJEExCpSE5iRYooPTYOOOGpMWg"}, {"nome": "Marcos", "id": "1aFuzn8x-6845Ww9Kvz-3v-uEVzSkaRZD"}]},
    {"titulo": "Dia 3", "pastas": [{"nome": "Brenda", "id": "18wZtCLROmUcG7-cgYIM__tRx2cd7ym_N"}, {"nome": "Júlia", "id": "1HJgoA0BNkyy0OlVoobBS-D-yqsY5XrNx"}, {"nome": "Marcos", "id": "1hIH73B4-g_AuOH01YDBP09R_QcqW6X9X"}]}
  ]
}'::jsonb
where id = 'imersao-nov-2026';
