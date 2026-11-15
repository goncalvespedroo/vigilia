-- =============================================================================
-- Vigília · Redesign · Paleta fria para as áreas (DESIGN-DIRECTIVE §4)
-- Converte as cores antigas (vermelho/âmbar/neon) para os equivalentes frios.
-- =============================================================================

-- Áreas padrão com a cor de fábrica ganham a cor nova de fábrica
update public.areas set cor = '#A6D5E5' where nome = 'TCC'       and upper(cor) = '#E5484D';
update public.areas set cor = '#8C9EDB' where nome = 'Faculdade' and upper(cor) = '#8AB4F8';
update public.areas set cor = '#B59A68' where nome = 'Equipe'    and upper(cor) = '#E2A336';
update public.areas set cor = '#7FB7A4' where nome = 'Pessoal'   and upper(cor) = '#7CF08A';

-- Demais: mapeamento cor a cor
update public.areas set cor = case upper(cor)
    when '#E5484D' then '#E08A96'
    when '#E2A336' then '#B59A68'
    when '#7CF08A' then '#7FB7A4'
    when '#2DD4BF' then '#5FA8C9'
    when '#8AB4F8' then '#8C9EDB'
    when '#C084FC' then '#C9A2C8'
    when '#F472B6' then '#E08A96'
    when '#ECE7DC' then '#D6DCE0'
  end
where upper(cor) in ('#E5484D', '#E2A336', '#7CF08A', '#2DD4BF', '#8AB4F8', '#C084FC', '#F472B6', '#ECE7DC');

create or replace function public.criar_areas_padrao(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.areas (user_id, nome, codigo, cor, ordem) values
    (p_user_id, 'Faculdade', 'OP-0044', '#8C9EDB', 1),
    (p_user_id, 'Equipe',    'OP-0031', '#B59A68', 2),
    (p_user_id, 'TCC',       'OP-0012', '#A6D5E5', 3),
    (p_user_id, 'Pessoal',   'OP-0050', '#7FB7A4', 4)
  on conflict (user_id, nome) do nothing;
$$;

revoke execute on function public.criar_areas_padrao(uuid) from public, anon, authenticated;
