-- =====================================================================
-- CAMBIO 11 oct 2026 · Pestañas "Café y bebidas" y "Cervezas y copas"
-- (aplicado en Neon con el OK de Carlos)
-- ---------------------------------------------------------------------
-- Dos pestañas nuevas, las primeras de la carta (es lo primero que pide
-- la gente), y 34 productos (ids 106–139). PRECIOS PROVISIONALES de bar de
-- Sevilla: las cartas físicas no traen bebidas. El local debe
-- confirmarlos; se cambian desde el panel (Lista de precios).
-- Solo añade: no cambia ni borra nada de lo que había.
-- =====================================================================
begin;

-- Las pestañas que ya había pasan detrás (1–7 → 3–9).
update categories set sort_order = sort_order + 2;

insert into categories (id, name, sort_order, multi, fam, labs) values
  ('cafe', 'CAFÉ Y BEBIDAS', 1, true, '', '{}'),
  ('cervezas', 'CERVEZAS Y COPAS', 2, true, '', '{}');

insert into products (id, category_id, name, display_name, description, size, only_size, section, price, featured, allergens, photo, sort_order) overriding system value values
  (106, 'cafe', 'Café solo', NULL, '', NULL, false, 'CAFÉS', 1.30, false, NULL, '', 106),
  (107, 'cafe', 'Cortado', NULL, '', NULL, false, 'CAFÉS', 1.40, false, NULL, '', 107),
  (108, 'cafe', 'Americano', NULL, '', NULL, false, 'CAFÉS', 1.40, false, NULL, '', 108),
  (109, 'cafe', 'Café con leche', NULL, '', NULL, false, 'CAFÉS', 1.60, false, NULL, '', 109),
  (110, 'cafe', 'Descafeinado', NULL, 'de máquina o de sobre', NULL, false, 'CAFÉS', 1.60, false, NULL, '', 110),
  (111, 'cafe', 'Carajillo', NULL, '', NULL, false, 'CAFÉS', 2.00, false, NULL, '', 111),
  (112, 'cafe', 'Infusión o té', NULL, 'manzanilla, poleo, menta o té', NULL, false, 'CAFÉS', 1.50, false, NULL, '', 112),
  (113, 'cafe', 'Cola Cao', NULL, '', NULL, false, 'CAFÉS', 1.80, false, NULL, '', 113),
  (114, 'cafe', 'Coca-Cola', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 114),
  (115, 'cafe', 'Coca-Cola Zero', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 115),
  (116, 'cafe', 'Fanta naranja', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 116),
  (117, 'cafe', 'Fanta limón', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 117),
  (118, 'cafe', 'Sprite', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 118),
  (119, 'cafe', 'Aquarius', NULL, 'limón o naranja', NULL, false, 'REFRESCOS Y AGUA', 2.40, false, NULL, '', 119),
  (120, 'cafe', 'Nestea', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.40, false, NULL, '', 120),
  (121, 'cafe', 'Tónica', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 121),
  (122, 'cafe', 'Zumo', NULL, 'naranja, piña o melocotón', NULL, false, 'REFRESCOS Y AGUA', 2.30, false, NULL, '', 122),
  (123, 'cafe', 'Agua', NULL, '50 cl', NULL, false, 'REFRESCOS Y AGUA', 1.50, false, NULL, '', 123),
  (124, 'cafe', 'Agua con gas', NULL, '', NULL, false, 'REFRESCOS Y AGUA', 1.80, false, NULL, '', 124),
  (125, 'cervezas', 'Caña Cruzcampo', NULL, '', NULL, false, 'CERVEZAS', 1.80, false, NULL, '', 125),
  (126, 'cervezas', 'Tubo Cruzcampo', NULL, '', NULL, false, 'CERVEZAS', 2.20, false, NULL, '', 126),
  (127, 'cervezas', 'Jarra Cruzcampo', NULL, '', NULL, false, 'CERVEZAS', 3.00, false, NULL, '', 127),
  (128, 'cervezas', 'Tercio Cruzcampo', NULL, '', NULL, false, 'CERVEZAS', 2.50, false, NULL, '', 128),
  (129, 'cervezas', 'Cruzcampo Especial', NULL, 'tercio', NULL, false, 'CERVEZAS', 2.80, false, NULL, '', 129),
  (130, 'cervezas', 'Alhambra Reserva 1925', NULL, 'tercio', NULL, false, 'CERVEZAS', 3.20, false, NULL, '', 130),
  (131, 'cervezas', 'Cerveza sin alcohol', NULL, 'tercio', NULL, false, 'CERVEZAS', 2.50, false, NULL, '', 131),
  (132, 'cervezas', 'Clara con limón', NULL, 'caña', NULL, false, 'CERVEZAS', 2.00, false, NULL, '', 132),
  (133, 'cervezas', 'Tinto de verano', NULL, '', NULL, false, 'CERVEZAS', 2.50, false, NULL, '', 133),
  (134, 'cervezas', 'Gin tonic', NULL, '', NULL, false, 'COMBINADOS', 7.00, false, NULL, '', 134),
  (135, 'cervezas', 'Gin tonic premium', NULL, 'ginebra premium a elegir', NULL, false, 'COMBINADOS', 9.00, false, NULL, '', 135),
  (136, 'cervezas', 'Ron con cola', NULL, '', NULL, false, 'COMBINADOS', 6.50, false, NULL, '', 136),
  (137, 'cervezas', 'Whisky con cola', NULL, '', NULL, false, 'COMBINADOS', 6.50, false, NULL, '', 137),
  (138, 'cervezas', 'Vodka con naranja o limón', NULL, '', NULL, false, 'COMBINADOS', 6.50, false, NULL, '', 138),
  (139, 'cervezas', 'Chupito', NULL, 'orujo, pacharán o licor de hierbas', NULL, false, 'COMBINADOS', 2.50, false, NULL, '', 139);

select setval(pg_get_serial_sequence('products','id'), (select max(id) from products));

commit;
