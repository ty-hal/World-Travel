BEGIN;

INSERT INTO trips (user_id,title,description,start_date,end_date,currency,source_id,date_precision,date_label)
SELECT 2,
  'Peru & Easter Island',
  '18 days; 11 days PTO. Late-April/early-May shoulder-season plan: Lima, Caral, Cusco, Sacred Valley, Machu Picchu, Rainbow Mountain, Humantay Lake, Santiago, and Rapa Nui. Keep Cusco Day 5 easy for acclimatization; hydrate, limit alcohol, and book Machu Picchu circuits/trains 4–6 months ahead. Rapa Nui requires the FUI, registered accommodation proof, and onward/return flight confirmation. Food targets: ceviche, picarones, anticuchos, chifa, cuy, alpaca, choclo con queso, lomo saltado, pastel de choclo, chorrillana, completos, tuna empanadas, and po’e. Estimated costs are planning estimates.',
  '2027-04-23','2027-05-10','USD','peru-easter-island-2027','day','Apr 23 – May 10, 2027'
WHERE NOT EXISTS (SELECT 1 FROM trips WHERE user_id=2 AND source_id='peru-easter-island-2027');

WITH itinerary(day_number,date,title,notes) AS (
  SELECT 1,'2027-04-23','Travel Day','ORD → LIM; about 11 hours with 1 connection; likely red-eye; about $500.'
  UNION ALL SELECT 2,'2027-04-24','Historic Lima','Land around 10 am. Plaza Mayor, Cathedral, San Francisco, Larco Museum, Barranco, and Puente de los Suspiros. Food: La Mar, Pan Atelier, Isolina.'
  UNION ALL SELECT 3,'2027-04-25','Pachacamac','Pachacamac 9 am–1 pm ($55); El Mercado; Miraflores, Parque del Amor, Malecón, Larcomar; Picarones Mary; Huaca Pucllana daytime; Madam Tusan.'
  UNION ALL SELECT 4,'2027-04-26','Caral Day Trip','5:30 am pickup; Caral around 10 am; lunch at Tato in Barranca; return around 7 pm; about $139.'
  UNION ALL SELECT 5,'2027-04-27','Travel and Acclimatization','LIM → CUZ, 1.5 hours, about $100. Coca or muña tea; Organika; Plaza de Armas, Cathedral, San Blas, Mirador de San Cristóbal; Uchu.'
  UNION ALL SELECT 6,'2027-04-28','Cusco & Four Ruins','9 am–2 pm tour, about $40: Qorikancha, Sacsayhuamán, Q’enqo, Puka Pukara, Tambomachay. San Pedro Market; optional ChocoMuseo or Pre-Columbian Art Museum; Pachapapa.'
  UNION ALL SELECT 7,'2027-04-29','Sacred Valley Exploration','Pisac market and ruins, Urubamba, Maras, Moray, and Ollantaytambo; tour about $100 plus $20 pass. Leave carry-on at Cusco hotel if possible; overnight Ollantaytambo; Amanto.'
  UNION ALL SELECT 8,'2027-04-30','Classic Machu Picchu Loop','Early train to Aguas Calientes; Consetur bus; Circuit 2A around 9 am, about $42 plus $30 guide; classic loop and optional Inca Bridge. Massage and artisan market.'
  UNION ALL SELECT 9,'2027-05-01','Huayna Picchu and Return to Cusco','Circuit 3A / Huayna Picchu at 7 am; steep one-hour climb and Temple of the Moon; about $78 total. Butterfly Zoo; train back to Cusco and retrieve checked bag.'
  UNION ALL SELECT 10,'2027-05-02','Rainbow Mountain & Red Valley','4:30 am pickup; 17,000-ft Rainbow Mountain and optional Red Valley; about $25 plus $18 entrance; return about 4:30 pm.'
  UNION ALL SELECT 11,'2027-05-03','Humantay Lake','4 am pickup; 14,000-ft hike; about $38; breakfast in Mollepata, hike, lunch, return around 6 pm.'
  UNION ALL SELECT 12,'2027-05-04','Travel and Santiago Explore','CUZ → SCL direct, 2.5 hours, about $300; Antigua Fuente; Barrio Lastarria and Barrio Italia; Peumayén.'
  UNION ALL SELECT 13,'2027-05-05','Santiago Sightseeing and Buffer','Santa Lucía, Plaza de Armas, Pre-Columbian Museum, GAM, San Cristóbal Funicular, mote con huesillo, and Sky Costanera at sunset. Food: La Piojera/Ciudad Vieja and Galindo.'
  UNION ALL SELECT 14,'2027-05-06','Travel to Rapa Nui','SCL → IPC, 5.5 hours, about $200; book via LATAM Chile. Tía Berta, Rapa Nui Museum, Hanga Kioe, Ana Kai Tangata, Tahai sunset; Te Moana.'
  UNION ALL SELECT 15,'2027-05-07','Rapa Nui East Circuit','9 am–3 pm Moai Monuments Tour, about $125: Ahu Tongariki, Rano Raraku, Anakena, and Ahu Vaihu. Bring lunch; Te Moai Sunset and dance show.'
  UNION ALL SELECT 16,'2027-05-08','Rapa Nui West and North Circuit','9 am–3 pm Historic Pathways Tour, about $125: Orongo, Rano Kau, Ahu Akivi, Poike, Vinapu, Ahu Huri A Urenga, and Puna Pau. Bring lunch; Neptuno Sunset and dance show.'
  UNION ALL SELECT 17,'2027-05-09','Return to Mainland Chile','Morning open; IPC → SCL, 4.5 hours, about $300; arrive around 10 pm; overnight Lastarria.'
  UNION ALL SELECT 18,'2027-05-10','Return Home','Morning open; SCL → connection → ORD, about 15 hours, about $400; arrive late afternoon/night.'
)
INSERT INTO days (trip_id,day_number,date,title,notes)
SELECT t.id,i.day_number,i.date,i.title,i.notes
FROM trips t CROSS JOIN itinerary i
WHERE t.source_id='peru-easter-island-2027'
  AND NOT EXISTS (SELECT 1 FROM days d WHERE d.trip_id=t.id AND d.day_number=i.day_number);

COMMIT;

BEGIN;
DROP TABLE IF EXISTS temp.peru_easter_places;
CREATE TEMP TABLE peru_easter_places (
  day_number INTEGER, place_order INTEGER, name TEXT, notes TEXT,
  lat REAL, lng REAL, transport_mode TEXT
);

INSERT INTO peru_easter_places VALUES
(1,1,'ORD → LIM','11 hours; 1 connection; about $500',-12.0219,-77.1143,'flight'),
(2,1,'Plaza Mayor of Lima','Historic center',-12.0464,-77.0428,'walking'),
(2,2,'Larco Museum','Museum',-12.0731,-77.0708,'walking'),
(2,3,'Barranco & Puente de los Suspiros','Neighborhood walk',-12.1490,-77.0200,'walking'),
(3,1,'Pachacamac Ruins','9 am–1 pm; about $55',-12.2570,-76.9020,'car'),
(3,2,'Miraflores & Huaca Pucllana','Daytime visit preferred',-12.1111,-77.0338,'walking'),
(4,1,'Caral','Day trip; 5:30 am pickup; about $139',-10.8925,-77.5200,'car'),
(5,1,'LIM → CUZ','1.5 hours; about $100',-13.5357,-71.9388,'flight'),
(5,2,'Cusco Plaza de Armas','Acclimatization walk',-13.5164,-71.9785,'walking'),
(6,1,'Qorikancha','',-13.5186,-71.9687,'walking'),
(6,2,'Sacsayhuamán','Four Ruins tour',-13.5098,-71.9828,'car'),
(6,3,'Mercado Central de San Pedro','Fruit juices and choclo con queso',-13.5188,-71.9819,'walking'),
(7,1,'Pisac Archaeological Park','Market and ruins',-13.4229,-71.8440,'car'),
(7,2,'Maras Salt Mines','About $20 Sacred Valley pass',-13.3025,-72.1567,'car'),
(7,3,'Moray Archaeological Site','Terraces',-13.3290,-72.1960,'car'),
(7,4,'Ollantaytambo Ruins & Town','Overnight near train station',-13.2588,-72.2630,'car'),
(8,1,'Ollantaytambo → Aguas Calientes','Expedition or Vistadome train; about $69',-13.1548,-72.5240,'train'),
(8,2,'Machu Picchu Circuit 2A','Classic loop; about $42 plus guide; book 4–6 months ahead',-13.1631,-72.5450,'bus'),
(9,1,'Huayna Picchu / Circuit 3A','7 am; steep climb; about $78 total',-13.1635,-72.5452,'bus'),
(9,2,'Aguas Calientes → Cusco','Train about $109; retrieve checked bag',-13.1548,-72.5240,'train'),
(10,1,'Rainbow Mountain & Red Valley','17,000 ft; about $25 plus $18 entrance',-13.5200,-71.4120,'car'),
(11,1,'Humantay Lake','14,000 ft; about $38',-13.4167,-72.5833,'car'),
(12,1,'CUZ → SCL','Direct flight; about $300',-33.3930,-70.7858,'flight'),
(12,2,'Barrio Lastarria & Barrio Italia','Explore after arrival',-33.4372,-70.6408,'walking'),
(13,1,'Pre-Columbian Art Museum','10 am–6 pm; closed Mondays',-33.4369,-70.6472,'walking'),
(13,2,'San Cristóbal Hill','Funicular and mote con huesillo',-33.4255,-70.6342,'funicular'),
(13,3,'Sky Costanera','Sunset',-33.4169,-70.6067,'walking'),
(14,1,'SCL → IPC','About 5.5 hours; about $200; LATAM Chile',-27.1648,-109.4218,'flight'),
(14,2,'Rapa Nui Museum','Museum',-27.1450,-109.4300,'walking'),
(14,3,'Ahu Tahai','Sunset',-27.1428,-109.4314,'walking'),
(15,1,'Ahu Tongariki','East circuit',-27.1258,-109.2777,'car'),
(15,2,'Rano Raraku Quarry','East circuit',-27.1249,-109.2890,'car'),
(15,3,'Anakena Beach','East circuit',-27.0750,-109.3230,'car'),
(16,1,'Orongo & Rano Kau','West/north circuit',-27.1840,-109.4380,'car'),
(16,2,'Ahu Akivi','West/north circuit',-27.1057,-109.3920,'car'),
(16,3,'Ahu Vinapu & Puna Pau','West/north circuit',-27.1700,-109.4230,'car'),
(17,1,'IPC → SCL','About 4.5 hours; arrive around 10 pm; about $300',-33.3930,-70.7858,'flight'),
(18,1,'SCL → ORD','Connection; about 15 hours; about $400',-41.9742,-87.9073,'flight');

INSERT INTO places (trip_id,name,notes,lat,lng,transport_mode,source_id)
SELECT t.id,p.name,p.notes,p.lat,p.lng,p.transport_mode,
       'peru-easter-island-2027-'||p.day_number||'-'||p.place_order
FROM trips t CROSS JOIN peru_easter_places p
WHERE t.source_id='peru-easter-island-2027'
  AND NOT EXISTS (
    SELECT 1 FROM places x
    WHERE x.trip_id=t.id
      AND x.source_id='peru-easter-island-2027-'||p.day_number||'-'||p.place_order
  );

INSERT INTO day_assignments (day_id,place_id,order_index)
SELECT d.id,p.id,e.place_order
FROM trips t
JOIN days d ON d.trip_id=t.id
JOIN peru_easter_places e ON e.day_number=d.day_number
JOIN places p ON p.trip_id=t.id
  AND p.source_id='peru-easter-island-2027-'||e.day_number||'-'||e.place_order
WHERE t.source_id='peru-easter-island-2027'
  AND NOT EXISTS (
    SELECT 1 FROM day_assignments a
    WHERE a.day_id=d.id AND a.place_id=p.id
  );

DROP TABLE temp.peru_easter_places;
COMMIT;
