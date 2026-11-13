#!/usr/bin/env node
/**
 * Seed South Korea, Andes Triangle, and Mexico itineraries (days + places + covers).
 * Usage: node scripts/seed-ty-korea-andes-mexico.mjs
 */
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../server/data/travel.db')
const USER_ID = 2

const H = 1, R = 2, A = 3, S = 4, T = 5, X = 6, C = 7, N = 9, O = 10

const COVERS = {
  'South Korea: Seoul to Busan': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Bulguksa_temple_entrance_gate_stairs_flower_bed_and_blue_sky_in_Gyeongju_South_Korea.jpg/1920px-Bulguksa_temple_entrance_gate_stairs_flower_bed_and_blue_sky_in_Gyeongju_South_Korea.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Haedong_Yonggungsa_Temple_20200522_044.jpg/1920px-Haedong_Yonggungsa_Temple_20200522_044.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Courtyard_of_colorful_paper_lanterns_and_shadow_patterns_at_Bulguksa_temple_Gyeongju_South_Korea.jpg/1920px-Courtyard_of_colorful_paper_lanterns_and_shadow_patterns_at_Bulguksa_temple_Gyeongju_South_Korea.jpg',
  ],
  'Andes Triangle: Colombia, Ecuador & Bolivia': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Cartagena_de_Indias_2.jpg/1920px-Cartagena_de_Indias_2.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Valle_de_Cocora%2C_Colombia_02.jpg/1920px-Valle_de_Cocora%2C_Colombia_02.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Salar_de_Uyuni%2C_Bolivia%2C_2016-02-04%2C_DD_10-12_HDR.JPG/1920px-Salar_de_Uyuni%2C_Bolivia%2C_2016-02-04%2C_DD_10-12_HDR.JPG',
  ],
  'Mexico: CDMX, Oaxaca, Palenque & Yucatán': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Pyramid_of_the_Sun%2C_Teotihuacan%2C_from_path_to_parking_lot.jpg/1920px-Pyramid_of_the_Sun%2C_Teotihuacan%2C_from_path_to_parking_lot.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Panorama_of_Monte_Alban_Archaeological_Site_-_Oaxaca_City_-_Oaxaca_-_Mexico_-_01_%286505604025%29.jpg/1920px-Panorama_of_Monte_Alban_Archaeological_Site_-_Oaxaca_City_-_Oaxaca_-_Mexico_-_01_%286505604025%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Chichen_Itza_3.jpg/1920px-Chichen_Itza_3.jpg',
  ],
}

/** @type {{ title: string, currency: string, description: string, days: { title: string, notes: string }[], places: { n: string, c?: number, notes?: string, lat?: number, lng?: number }[][] }[]} */
const TRIPS = [
  {
    title: 'South Korea: Seoul to Busan',
    currency: 'KRW',
    description:
      '14 days open-jaw: ORD → ICN, return PUS/ICN → ORD. Seoul (palaces, DMZ, markets) → Jeonju hanok/food → Gyeongju Silla ruins → Busan coast. Best Apr–May; avoid Chuseok, Seollal, Jul–Aug monsoon. KakaoMap/Naver Map required (Google Maps weak). Optional: Jeju Seongsan Ilchulbong; Suwon Hwaseong.',
    days: [
      { title: 'ORD → ICN', notes: 'Depart Chicago O\'Hare. ~14–15h direct United/Korean Air (~$1,250). Cross the Pacific toward the Korean peninsula.' },
      { title: 'Arrival & Neon Alleys', notes: 'Land ICN ~3:30 PM. AREX to Seoul Station (~$8, 43 min). Hotel Jongno/Jung-gu (~$95). Evening Myeongdong or Insadong; Korean BBQ or Samgyetang (~$25).' },
      { title: 'Grand Palaces & Hanok Villages', notes: 'Gyeongbokgung + Changing of the Guard 10:00 (~$3). Bukchon Hanok Village. National Museum of Korea afternoon.' },
      { title: 'Stream Hikes, N Seoul Tower & Night Markets', notes: 'Cheonggyecheon Stream. Namsan / N Seoul Tower (~$12). Evening Gwangjang Market street-food crawl (~$15).' },
      { title: 'The DMZ Border Excursion', notes: 'Guided DMZ day (~$65, passport required): Dorasan Observatory, Third Infiltration Tunnel, Imjingak. Evening Hongdae or Seongsu-dong.' },
      { title: 'Fortress Walls & City Overlooks', notes: 'Seoul City Wall trek (Naksan or Inwangsan). Afternoon Namdaemun Market crafts/ginseng.' },
      { title: 'KTX to the Food Kingdom', notes: 'KTX Seoul → Jeonju. Jeonju Hanok Village + Bibimbap (~$15). Gyeonggijeon Shrine. Hotel: hanok stay (~$75).' },
      { title: 'Hanji Paper & Makgeolli Alleys', notes: 'Jeonju Hanji Museum/workshop. Jaman Mural Village. Evening Makgeolli Alleys (~$25).' },
      { title: 'Train to the Ancient Silla Capital', notes: 'Express to Gyeongju. Daereungwon / Cheonmachong (~$3). Cheomseongdae. Night Donggung & Wolji Pond (~$3). Hotel Historic Center (~$80).' },
      { title: 'Cliffside Grottos & Monumental Temples', notes: 'Bulguksa Temple (~$5). Seokguram Grotto (~$5). Hwangridan-gil cafes.' },
      { title: 'Regional Rail to the Coast', notes: 'Train Gyeongju → Busan (~1h). Jagalchi Fish Market lunch (~$20). Gamcheon Culture Village. Hotel Haeundae/Gwangan (~$85).' },
      { title: 'Coastal Temples & Sky Capsules', notes: 'Haedong Yonggungsa. Haeundae Blueline Sky Capsules (~$25). Evening Gwangalli Beach + Gwangan Bridge lights.' },
      { title: 'Cliff Hikes & Farewell Feast', notes: 'Taejongdae or Igidae Coastal Walk. BIFF Square / Nampodong. Farewell Dwaeji Gukbap (~$12).' },
      { title: 'PUS / ICN → ORD', notes: 'Fly PUS with connection, or KTX Busan → ICN (~2.5h) then long-haul home (~$1,100). Land ORD same calendar day.' },
    ],
    places: [
      [{ n: 'ORD → ICN', c: T, notes: '[transport] Long-haul to Incheon ~14–15h.', lat: 41.9742, lng: -87.9073 }],
      [
        { n: 'Incheon International Airport (ICN)', c: T, notes: '[transport] Arrival, customs, immigration.', lat: 37.4602, lng: 126.4407 },
        { n: 'AREX to Seoul Station', c: T, notes: '[transport] Airport Railroad Express ~$8, 43 min.' },
        { n: 'Hotel — Jongno / Jung-gu', c: H, notes: '[lodging] ~$95/night.', lat: 37.5735, lng: 126.9788 },
        { n: 'Myeongdong or Insadong stroll', c: A, notes: '[activity] Welcome walk alleys/shopfronts.', lat: 37.5636, lng: 126.9869 },
        { n: 'Korean BBQ or Samgyetang', c: R, notes: '[food] Welcome dinner ~$25.' },
      ],
      [
        { n: 'Gyeongbokgung Palace', c: A, notes: '[activity] Joseon main palace; guard ceremony 10:00 ~$3.', lat: 37.5796, lng: 126.9770 },
        { n: 'Bukchon Hanok Village', c: A, notes: '[activity] Traditional courtyard houses.', lat: 37.5826, lng: 126.9831 },
        { n: 'National Museum of Korea', c: A, notes: '[activity] Buddhist sculpture, crowns, porcelain.', lat: 37.5239, lng: 126.9803 },
      ],
      [
        { n: 'Cheonggyecheon Stream', c: N, notes: '[activity] Urban stream walk.', lat: 37.5700, lng: 126.9784 },
        { n: 'N Seoul Tower / Namsan', c: A, notes: '[activity] Cable car or hike; panorama ~$12.', lat: 37.5512, lng: 126.9882 },
        { n: 'Gwangjang Market', c: S, notes: '[food] Bindaetteok, mayak gimbap, kalguksu ~$15.', lat: 37.5700, lng: 126.9996 },
      ],
      [
        { n: 'DMZ day tour', c: X, notes: '[activity] Dorasan, Third Tunnel, Imjingak ~$65; passport required.', lat: 37.9078, lng: 126.7122 },
        { n: 'Hongdae or Seongsu-dong', c: C, notes: '[activity] Evening cafes/fashion.', lat: 37.5563, lng: 126.9236 },
      ],
      [
        { n: 'Seoul City Wall trail', c: N, notes: '[activity] Naksan or Inwangsan fortifications (1396).', lat: 37.5808, lng: 127.0075 },
        { n: 'Namdaemun Market', c: S, notes: '[shopping] Handicrafts, ginseng.', lat: 37.5593, lng: 126.9770 },
      ],
      [
        { n: 'KTX Seoul → Jeonju', c: T, notes: '[transport] Bullet train south.', lat: 35.8242, lng: 127.1480 },
        { n: 'Jeonju Hanok Village', c: A, notes: '[activity] 700+ hanoks; Jeonju Bibimbap ~$15.', lat: 35.8150, lng: 127.1530 },
        { n: 'Gyeonggijeon Shrine', c: A, notes: '[activity] King Taejo portrait shrine (1410).', lat: 35.8154, lng: 127.1499 },
        { n: 'Hotel — Jeonju hanok stay', c: H, notes: '[lodging] ~$75/night.' },
      ],
      [
        { n: 'Jeonju Hanji Museum / workshop', c: A, notes: '[activity] Traditional mulberry paper.', lat: 35.8150, lng: 127.1500 },
        { n: 'Jaman Mural Village', c: A, notes: '[activity] Hillside murals over old roofs.', lat: 35.8125, lng: 127.1570 },
        { n: 'Makgeolli Alleys', c: C, notes: '[food] Rice wine + tapas plates ~$25.' },
      ],
      [
        { n: 'Express train → Gyeongju', c: T, notes: '[transport] East to Silla capital.', lat: 35.8562, lng: 129.2247 },
        { n: 'Daereungwon Tomb Park', c: A, notes: '[activity] Cheonmachong Heavenly Horse tomb ~$3.', lat: 35.8370, lng: 129.2110 },
        { n: 'Cheomseongdae Observatory', c: A, notes: '[activity] 7th-c astronomy tower.', lat: 35.8347, lng: 129.2190 },
        { n: 'Donggung Palace & Wolji Pond', c: A, notes: '[activity] Night illumination ~$3.', lat: 35.8340, lng: 129.2260 },
        { n: 'Hotel — Gyeongju Historic Center', c: H, notes: '[lodging] ~$80/night.' },
      ],
      [
        { n: 'Bulguksa Temple', c: A, notes: '[activity] Silla masterpiece ~$5.', lat: 35.7900, lng: 129.3320 },
        { n: 'Seokguram Grotto', c: A, notes: '[activity] Granite Buddha cave ~$5.', lat: 35.7947, lng: 129.3500 },
        { n: 'Hwangridan-gil', c: C, notes: '[activity] Hanok cafes street.' },
      ],
      [
        { n: 'Train Gyeongju → Busan', c: T, notes: '[transport] ~1h south.', lat: 35.1796, lng: 129.0756 },
        { n: 'Jagalchi Fish Market', c: S, notes: '[food] Live tanks; upstairs lunch ~$20.', lat: 35.0966, lng: 129.0306 },
        { n: 'Gamcheon Culture Village', c: A, notes: '[activity] Rainbow hillside alleys.', lat: 35.0975, lng: 129.0103 },
        { n: 'Hotel — Haeundae / Gwangan', c: H, notes: '[lodging] ~$85/night.', lat: 35.1587, lng: 129.1604 },
      ],
      [
        { n: 'Haedong Yonggungsa Temple', c: A, notes: '[activity] Cliffside ocean temple.', lat: 35.1881, lng: 129.2232 },
        { n: 'Haeundae Blueline Sky Capsules', c: X, notes: '[activity] Coastal rail cabins ~$25.', lat: 35.1580, lng: 129.1600 },
        { n: 'Gwangalli Beach & Gwangan Bridge', c: 8, notes: '[activity] Night bridge light show.', lat: 35.1532, lng: 129.1186 },
      ],
      [
        { n: 'Taejongdae or Igidae Coastal Walk', c: N, notes: '[activity] Cliffs, suspension bridges, sea caves.', lat: 35.0525, lng: 129.0850 },
        { n: 'BIFF Square / Nampodong', c: S, notes: '[shopping] Street stalls and shops.', lat: 35.0985, lng: 129.0270 },
        { n: 'Dwaeji Gukbap farewell', c: R, notes: '[food] Busan pork bone broth ~$12.' },
      ],
      [{ n: 'PUS / ICN → ORD', c: T, notes: '[transport] Open-jaw return ~16–18h with connection ~$1,100.', lat: 35.1795, lng: 128.9382 }],
    ],
  },
  {
    title: 'Andes Triangle: Colombia, Ecuador & Bolivia',
    currency: 'USD',
    description:
      '20 days: Cartagena → Bogotá → Salento/Cocora → Quito → Cotopaxi → Cuenca → Sucre → Potosí → Uyuni → La Paz → ORD. Mix of domestic flights and coaches; book domestics 6+ weeks out. Acclimatize 2 days before Potosí/Uyuni. Optional: Isla del Sol; Cal Orck’o (listed in Sucre day).',
    days: [
      { title: 'Arrive in Cartagena', notes: 'Land CTG. Transfer to Walled City hotel. Sunset on city walls; dinner San Diego Caribbean-fusion.' },
      { title: 'Cartagena Exploration', notes: 'San Felipe de Barajas Castle. Getsemaní streets. Evening Plaza de la Trinidad live music.' },
      { title: 'Fly to Bogotá', notes: 'CTG → BOG. Gold Museum. Evening Monserrate funicular night views.' },
      { title: 'Fly to Coffee Country (Salento)', notes: 'BOG → AXM or PEI. Transfer to Salento. Main square; patacón dinner. Guesthouse check-in.' },
      { title: 'Cocora Valley Trek', notes: 'Jeep Willys to Cocora. Wax palm loop hike; optional Acaime hummingbirds. Trout dinner in Salento.' },
      { title: 'Finca Tour & Artisanal Culture', notes: 'High-altitude coffee finca. Calle Real textiles/crafts. Quiet mountain evening.' },
      { title: 'Transit to Quito', notes: 'Fly Coffee Axis via Bogotá → UIO. Hotel Historic Old Town.' },
      { title: 'Historic Quito', notes: 'Church of the Compañía de Jesús. La Ronda workshops. Panecillo viewpoint lights.' },
      { title: 'Volcanoes & Landscapes', notes: 'Full-day Cotopaxi National Park; Limpiopungo Lagoon. Highland hacienda night.' },
      { title: 'Cotopaxi Exploration', notes: 'Horseback or lower-slope hike. Return Quito or transition south. Quiet city dinner.' },
      { title: 'Transit to Cuenca', notes: 'Domestic flight or scenic bus to Cuenca. Tomebamba riverfront evening.' },
      { title: 'Cuenca Culture', notes: 'New Cathedral and flower markets. Pumapungo Archaeological Park. Plaza dinner.' },
      { title: 'Cajas National Park', notes: 'Full-day high-altitude lakes and páramo hiking. Return Cuenca.' },
      { title: 'Fly to Bolivia', notes: 'Cuenca/Guayaquil → La Paz → Sucre. Hotel Sucre; start acclimatization.' },
      { title: 'Sucre Colonial History', notes: 'House of Liberty; Cathedral. Cal Orck’o dinosaur tracks. Main square evening.' },
      { title: 'Potosí Mining Heritage', notes: 'Bus to Potosí. Casa Nacional de Moneda + mine history sites. Return Sucre or overnight Potosí.' },
      { title: 'Journey to Uyuni', notes: 'Transfer to Uyuni. Meet 4x4 guide; start salt flats. Sunset on the salar.' },
      { title: 'Salt Flats & Cacti', notes: 'Train Cemetery, Incahuasi Island, salt crust. Overnight salt hotel or desert outpost.' },
      { title: 'High Desert Lagoons', notes: 'Mineral lagoons and flamingos. Final expedition night before Uyuni.' },
      { title: 'La Paz & Return Home', notes: 'Fly Uyuni → La Paz. Mi Teleférico + Witches’ Market. Evening airport for ORD.' },
    ],
    places: [
      [
        { n: 'Rafael Núñez Airport (CTG)', c: T, notes: '[transport] Arrival Cartagena.', lat: 10.4424, lng: -75.5130 },
        { n: 'Hotel — Cartagena Walled City', c: H, notes: '[lodging] Centro Histórico.', lat: 10.4236, lng: -75.5510 },
        { n: 'Cartagena city walls sunset', c: A, notes: '[activity] Historic murallas walk.', lat: 10.4225, lng: -75.5500 },
        { n: 'San Diego Caribbean dinner', c: R, notes: '[food] Fusion restaurant evening.' },
      ],
      [
        { n: 'San Felipe de Barajas Castle', c: A, notes: '[activity] Massive fortress tour.', lat: 10.4220, lng: -75.5390 },
        { n: 'Getsemaní neighborhood', c: A, notes: '[activity] Flower-lined streets.', lat: 10.4180, lng: -75.5460 },
        { n: 'Plaza de la Trinidad', c: C, notes: '[activity] Live music and street performances.', lat: 10.4175, lng: -75.5455 },
      ],
      [
        { n: 'CTG → BOG flight', c: T, notes: '[transport] Domestic hop to Bogotá.', lat: 4.7016, lng: -74.1469 },
        { n: 'Museo del Oro', c: A, notes: '[activity] Pre-Hispanic gold collection.', lat: 4.6019, lng: -74.0721 },
        { n: 'Monserrate funicular', c: A, notes: '[activity] Night view of the basin.', lat: 4.6058, lng: -74.0550 },
      ],
      [
        { n: 'BOG → AXM/PEI flight', c: T, notes: '[transport] Coffee Axis arrival.', lat: 4.4526, lng: -75.7664 },
        { n: 'Transfer to Salento', c: T, notes: '[transport] Private transfer or shuttle.', lat: 4.6370, lng: -75.5700 },
        { n: 'Salento main square', c: A, notes: '[activity] Evening walk.', lat: 4.6375, lng: -75.5705 },
        { n: 'Patacón dinner', c: R, notes: '[food] Fried plantain traditional meal.' },
        { n: 'Guesthouse — Salento', c: H, notes: '[lodging] Mountain town stay.' },
      ],
      [
        { n: 'Jeep Willys to Cocora', c: T, notes: '[transport] From Salento square.' },
        { n: 'Cocora Valley wax palms', c: N, notes: '[activity] Loop hike; optional Acaime sanctuary.', lat: 4.6370, lng: -75.4880 },
        { n: 'Trout dinner Salento', c: R, notes: '[food] Fresh-caught trout.' },
      ],
      [
        { n: 'Coffee finca tour', c: X, notes: '[activity] Harvest and processing steps.' },
        { n: 'Calle Real crafts', c: S, notes: '[shopping] Hand-woven textiles.', lat: 4.6378, lng: -75.5708 },
      ],
      [
        { n: 'Fly to Quito (UIO)', c: T, notes: '[transport] Via Bogotá from Coffee Axis.', lat: -0.1807, lng: -78.4678 },
        { n: 'Hotel — Quito Old Town', c: H, notes: '[lodging] Historic center.', lat: -0.2200, lng: -78.5125 },
      ],
      [
        { n: 'Church of the Compañía de Jesús', c: A, notes: '[activity] Golden interior.', lat: -0.2208, lng: -78.5136 },
        { n: 'La Ronda street', c: A, notes: '[activity] Traditional workshops.', lat: -0.2235, lng: -78.5150 },
        { n: 'El Panecillo viewpoint', c: A, notes: '[activity] City lights.', lat: -0.2289, lng: -78.5183 },
      ],
      [
        { n: 'Cotopaxi National Park', c: N, notes: '[activity] Limpiopungo Lagoon day trip.', lat: -0.6800, lng: -78.4400 },
        { n: 'Highland hacienda', c: H, notes: '[lodging] Overnight near park.' },
      ],
      [
        { n: 'Cotopaxi lower slopes', c: X, notes: '[activity] Horseback or short hike.' },
        { n: 'Return Quito dinner', c: R, notes: '[food] Quiet city evening.' },
      ],
      [
        { n: 'Transit to Cuenca', c: T, notes: '[transport] Flight or scenic bus south.', lat: -2.9001, lng: -79.0059 },
        { n: 'Tomebamba riverfront', c: A, notes: '[activity] Colonial architecture walk.', lat: -2.8970, lng: -79.0040 },
        { n: 'Hotel — Cuenca', c: H, notes: '[lodging] Historic city.' },
      ],
      [
        { n: 'New Cathedral & flower markets', c: A, notes: '[activity] Morning Cuenca icons.', lat: -2.8974, lng: -79.0045 },
        { n: 'Pumapungo Archaeological Park', c: A, notes: '[activity] Inca/Cañari site museum.', lat: -2.9060, lng: -78.9930 },
        { n: 'Plaza Ecuadorian dinner', c: R, notes: '[food] Traditional dinner.' },
      ],
      [
        { n: 'Cajas National Park', c: N, notes: '[activity] Glacial lakes and páramo hike.', lat: -2.8333, lng: -79.1667 },
      ],
      [
        { n: 'Fly to Sucre via La Paz', c: T, notes: '[transport] International/domestic links into Bolivia.', lat: -19.0196, lng: -65.2619 },
        { n: 'Hotel — Sucre', c: H, notes: '[lodging] Begin altitude acclimatization.' },
      ],
      [
        { n: 'House of Liberty', c: A, notes: '[activity] Independence history.', lat: -19.0478, lng: -65.2597 },
        { n: 'Sucre Cathedral', c: A, notes: '[activity] Colonial cathedral.', lat: -19.0475, lng: -65.2600 },
        { n: 'Cal Orck’o dinosaur tracks', c: A, notes: '[activity] Cliffside footprint wall.', lat: -19.0040, lng: -65.2360 },
        { n: 'Sucre main square', c: C, notes: '[activity] Evening atmosphere.', lat: -19.0477, lng: -65.2599 },
      ],
      [
        { n: 'Bus Sucre → Potosí', c: T, notes: '[transport] High mining city.', lat: -19.5723, lng: -65.7550 },
        { n: 'Casa Nacional de Moneda', c: A, notes: '[activity] National Mint museum.', lat: -19.5880, lng: -65.7535 },
        { n: 'Potosí mine history sites', c: A, notes: '[activity] Surface-level heritage.' },
      ],
      [
        { n: 'Transfer to Uyuni', c: T, notes: '[transport] Meet 4x4 expedition.', lat: -20.4597, lng: -66.8260 },
        { n: 'Salar de Uyuni sunset', c: N, notes: '[activity] First salt-flat evening.', lat: -20.1338, lng: -67.4891 },
      ],
      [
        { n: 'Train Cemetery', c: A, notes: '[activity] Rusting locomotives on the salar edge.', lat: -20.4880, lng: -66.8360 },
        { n: 'Incahuasi Island', c: N, notes: '[activity] Giant cacti island on salt crust.', lat: -20.2420, lng: -67.6260 },
        { n: 'Salt hotel / desert outpost', c: H, notes: '[lodging] Overnight on expedition.' },
      ],
      [
        { n: 'High desert lagoons', c: N, notes: '[activity] Mineral waters; flamingo habitats.', lat: -22.3500, lng: -67.8000 },
      ],
      [
        { n: 'Uyuni → La Paz flight', c: T, notes: '[transport] Return to capital.', lat: -16.5133, lng: -68.1923 },
        { n: 'Mi Teleférico', c: X, notes: '[activity] Cable-car network ride.', lat: -16.5000, lng: -68.1500 },
        { n: 'Witches’ Market', c: S, notes: '[shopping] Aymara market stalls.', lat: -16.4960, lng: -68.1390 },
        { n: 'La Paz → ORD', c: T, notes: '[transport] International departure home.' },
      ],
    ],
  },
  {
    title: 'Mexico: CDMX, Oaxaca, Palenque & Yucatán',
    currency: 'MXN',
    description:
      '14 days: ORD → CDMX → Oaxaca → Palenque (via TGZ) → Tren Maya to Mérida → Uxmal/Mayapán → Chichén Itzá → CUN/MID → ORD. Best Mar–Apr; avoid Day of the Dead peak bookings and Aug–Oct hurricane season on Yucatán. Optional: Hierve el Agua; Celestún flamingos. Prefer cuota toll roads; verified ATMs indoors.',
    days: [
      { title: 'Arrival and Historic Center', notes: 'ORD → CDMX. Uber/secure taxi to hotel. Zócalo + Templo Mayor. Dinner Centro Histórico.' },
      { title: 'Essential Archaeological Context', notes: 'National Anthropology Museum 3–4h (Chapultepec). Reforma / Roma–Condesa stroll. Roma Norte contemporary dinner.' },
      { title: 'Full-Day Excursion to Teotihuacán', notes: 'Guided tour or Terminal del Norte bus. Avenue of the Dead, Pyramids of Sun & Moon. Quiet evening back in CDMX.' },
      { title: 'Neighborhoods and Canals', notes: 'Coyoacán cobblestones/plazas. Xochimilco trajinera canals. Final CDMX dinner.' },
      { title: 'Transit to Oaxaca and Market Focus', notes: 'CDMX → OAX (~1h). Mercado 20 de Noviembre lunch. Evening mole tasting / culinary walk.' },
      { title: 'Hilltop Capitals and Giant Trees', notes: 'Monte Albán morning. Tule Tree stop. Tlayudas dinner in town.' },
      { title: 'Geometric Stone Mosaics', notes: 'Mitla mosaics. Palenque mezcal or Teotitlán del Valle textiles. Final Oaxaca zócalo evening.' },
      { title: 'Long Transit Day into Chiapas', notes: 'OAX → TGZ flight. ADO/private transfer ~4.5–5h to Palenque. Jungle lodge; howler monkeys.' },
      { title: 'Jungle-Shrouded Ruins', notes: 'Early Palenque Ruins (heat + crowds). Rest or site museum (Pakal). Dinner El Panchán.' },
      { title: 'Rainforest Waterfalls', notes: 'Misol-Ha behind-the-falls path. Agua Azul turquoise cascades. Pack for departure.' },
      { title: 'Boarding the Tren Maya to Yucatán', notes: 'Palenque rail terminal → Mérida (~5–6h). Paseo de Montejo evening; Yucatecan café.' },
      { title: 'Architectural Masterpieces of Uxmal', notes: 'Day tour/ADO to Uxmal (Pyramid of the Magician, Governor’s Palace). Mérida plaza/cathedral. Cochinita pibil dinner.' },
      { title: 'The Last Great Mayan Capital', notes: 'Mayapán day trip (uncrowded). Cenote swim. Mérida evening squares/music.' },
      { title: 'Chichén Itzá to Airport Transit', notes: 'Early to Chichén Itzá (El Castillo, ball court, Sacred Cenote). Lunch Valladolid. Transfer CUN or MID → ORD.' },
    ],
    places: [
      [
        { n: 'ORD → CDMX', c: T, notes: '[transport] Direct flight Chicago → Mexico City.', lat: 19.4361, lng: -99.0719 },
        { n: 'Hotel — Centro Histórico', c: H, notes: '[lodging] Near Zócalo.', lat: 19.4326, lng: -99.1332 },
        { n: 'Zócalo', c: A, notes: '[activity] Main square historic center.', lat: 19.4326, lng: -99.1332 },
        { n: 'Templo Mayor', c: A, notes: '[activity] Aztec excavated heart of Tenochtitlán.', lat: 19.4346, lng: -99.1319 },
        { n: 'Centro Histórico dinner', c: R, notes: '[food] First-night dinner.' },
      ],
      [
        { n: 'National Anthropology Museum', c: A, notes: '[activity] 3–4h Zapotec/Mixtec/Aztec/Maya context.', lat: 19.4260, lng: -99.1863 },
        { n: 'Roma / Condesa stroll', c: A, notes: '[activity] Leafy neighborhoods; Reforma option.', lat: 19.4190, lng: -99.1670 },
        { n: 'Roma Norte dinner', c: R, notes: '[food] Contemporary Mexican cuisine.' },
      ],
      [
        { n: 'Teotihuacán day trip', c: A, notes: '[activity] Avenue of the Dead; Sun & Moon pyramids.', lat: 19.6925, lng: -98.8438 },
        { n: 'Lunch near archaeological park', c: R, notes: '[food] Late lunch before return.' },
      ],
      [
        { n: 'Coyoacán', c: A, notes: '[activity] Cobblestone plazas.', lat: 19.3500, lng: -99.1620 },
        { n: 'Xochimilco trajinera', c: X, notes: '[activity] Aztec canal boat ride.', lat: 19.2630, lng: -99.1040 },
        { n: 'Final CDMX dinner', c: R, notes: '[food] Farewell capital evening.' },
      ],
      [
        { n: 'CDMX → OAX flight', c: T, notes: '[transport] ~1h domestic.', lat: 17.0017, lng: -96.7266 },
        { n: 'Hotel — Oaxaca Centro', c: H, notes: '[lodging] Walkable historic center.', lat: 17.0600, lng: -96.7250 },
        { n: 'Mercado 20 de Noviembre', c: S, notes: '[food] Authentic market lunch.', lat: 17.0585, lng: -96.7255 },
        { n: 'Mole tasting / culinary walk', c: R, notes: '[food] Complex Oaxacan sauces.' },
      ],
      [
        { n: 'Monte Albán', c: A, notes: '[activity] Zapotec capital on plateau.', lat: 17.0438, lng: -96.7676 },
        { n: 'Árbol del Tule', c: N, notes: '[activity] Massive Montezuma cypress.', lat: 17.0467, lng: -96.6361 },
        { n: 'Tlayudas dinner', c: R, notes: '[food] Large toasted tortillas with beans/meat/cheese.' },
      ],
      [
        { n: 'Mitla', c: A, notes: '[activity] Geometric mosaic stonework.', lat: 16.9270, lng: -96.3590 },
        { n: 'Palenque mezcal or Teotitlán textiles', c: X, notes: '[activity] Artisanal mezcal or weaving village.' },
        { n: 'Oaxaca zócalo evening', c: C, notes: '[activity] Final night atmosphere.', lat: 17.0602, lng: -96.7254 },
      ],
      [
        { n: 'OAX → TGZ flight', c: T, notes: '[transport] Into Chiapas.', lat: 16.5636, lng: -93.0263 },
        { n: 'ADO / transfer → Palenque', c: T, notes: '[transport] 4.5–5h highland to rainforest.', lat: 17.5090, lng: -91.9820 },
        { n: 'Jungle lodge — Palenque', c: H, notes: '[lodging] Howler monkeys at night.' },
      ],
      [
        { n: 'Palenque Ruins', c: A, notes: '[activity] Early entry; temples and stucco reliefs.', lat: 17.4838, lng: -92.0463 },
        { n: 'Palenque site museum', c: A, notes: '[activity] Pakal tomb artifacts.' },
        { n: 'El Panchán dinner', c: R, notes: '[food] Rustic zone by the park.' },
      ],
      [
        { n: 'Misol-Ha waterfall', c: N, notes: '[activity] Path behind the falls.', lat: 17.3700, lng: -91.7600 },
        { n: 'Agua Azul cascades', c: N, notes: '[activity] Tiered turquoise pools.', lat: 17.2500, lng: -91.7000 },
      ],
      [
        { n: 'Tren Maya Palenque → Mérida', c: T, notes: '[transport] Scenic 5–6h rail.', lat: 20.9674, lng: -89.5926 },
        { n: 'Hotel — Mérida', c: H, notes: '[lodging] Colonial base.', lat: 20.9670, lng: -89.6237 },
        { n: 'Paseo de Montejo', c: A, notes: '[activity] Pastel mansion boulevard.', lat: 20.9840, lng: -89.6200 },
        { n: 'Yucatecan café dinner', c: R, notes: '[food] Regional café.' },
      ],
      [
        { n: 'Uxmal', c: A, notes: '[activity] Pyramid of the Magician; Governor’s Palace (Puuc).', lat: 20.3595, lng: -89.7703 },
        { n: 'Mérida plaza & cathedral', c: A, notes: '[activity] Historic center return.', lat: 20.9670, lng: -89.6237 },
        { n: 'Cochinita pibil dinner', c: R, notes: '[food] Slow-roasted achiote pork.' },
      ],
      [
        { n: 'Mayapán', c: A, notes: '[activity] Last great Mayan capital; uncrowded.', lat: 20.6290, lng: -89.4600 },
        { n: 'Cenote swim', c: 8, notes: '[activity] Underground limestone pool cool-off.' },
        { n: 'Mérida evening squares', c: C, notes: '[activity] Street music.' },
      ],
      [
        { n: 'Chichén Itzá', c: A, notes: '[activity] El Castillo, ball court, Sacred Cenote.', lat: 20.6843, lng: -88.5678 },
        { n: 'Valladolid lunch', c: R, notes: '[food] Colorful colonial town.', lat: 20.6890, lng: -88.2010 },
        { n: 'CUN / MID → ORD', c: T, notes: '[transport] Return flight to Chicago.', lat: 21.0365, lng: -86.8771 },
      ],
    ],
  },
]

function main() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(USER_ID)
  if (!user) {
    console.error(`User id ${USER_ID} not found`)
    process.exit(1)
  }
  console.log(`Seeding for ${user.username} id=${user.id}`)

  const existing = new Map(
    db.prepare('SELECT id, title FROM trips WHERE user_id = ?').all(USER_ID).map((r) => [r.title, r.id]),
  )

  const insertTrip = db.prepare(`
    INSERT INTO trips (user_id, title, description, start_date, end_date, currency, reminder_days, cover_image)
    VALUES (?, ?, ?, NULL, NULL, ?, 3, ?)
  `)
  const insertDay = db.prepare(`
    INSERT INTO days (trip_id, day_number, date, title, notes) VALUES (?, ?, NULL, ?, ?)
  `)
  const updateCover = db.prepare('UPDATE trips SET cover_image = ? WHERE id = ?')
  const daysStmt = db.prepare('SELECT id, day_number FROM days WHERE trip_id = ? ORDER BY day_number')
  const delAssign = db.prepare(
    `DELETE FROM day_assignments WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?)`,
  )
  const delPlaces = db.prepare('DELETE FROM places WHERE trip_id = ?')
  const insertPlace = db.prepare(`
    INSERT INTO places (trip_id, name, lat, lng, category_id, notes, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, 60)
  `)
  const insertAssign = db.prepare(`
    INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, ?)
  `)

  const seedOne = db.transaction((trip) => {
    const covers = COVERS[trip.title] || []
    let tripId = existing.get(trip.title)
    if (!tripId) {
      if (trip.days.length !== trip.places.length) {
        throw new Error(`${trip.title}: ${trip.days.length} days vs ${trip.places.length} place-days`)
      }
      const r = insertTrip.run(USER_ID, trip.title, trip.description, trip.currency, covers[0] || null)
      tripId = Number(r.lastInsertRowid)
      trip.days.forEach((d, i) => insertDay.run(tripId, i + 1, d.title, d.notes))
      existing.set(trip.title, tripId)
      console.log(`CREATED #${tripId} ${trip.title} (${trip.days.length} days)`)
    } else {
      updateCover.run(covers[0] || null, tripId)
      console.log(`EXISTS #${tripId} ${trip.title} — refreshing places + cover`)
    }

    delAssign.run(tripId)
    delPlaces.run(tripId)
    const days = daysStmt.all(tripId)
    if (days.length !== trip.places.length) {
      throw new Error(`${trip.title}: DB ${days.length} days, seed ${trip.places.length}`)
    }
    let n = 0
    trip.places.forEach((stops, i) => {
      const dayId = days[i].id
      stops.forEach((s, j) => {
        const cat = typeof s.c === 'number' && !Number.isNaN(s.c) ? s.c : O
        const pr = insertPlace.run(tripId, s.n, s.lat ?? null, s.lng ?? null, cat, s.notes ?? null)
        insertAssign.run(dayId, Number(pr.lastInsertRowid), j)
        n++
      })
    })
    return { tripId, places: n }
  })

  let totalPlaces = 0
  for (const trip of TRIPS) {
    // Validate day/place alignment
    if (trip.days.length !== trip.places.length) {
      console.error(`MISMATCH ${trip.title}: days=${trip.days.length} placesDays=${trip.places.length}`)
      process.exit(1)
    }
    const out = seedOne(trip)
    console.log(`  → ${out.places} places`)
    totalPlaces += out.places
  }

  console.log(`\nDone. ${totalPlaces} places across ${TRIPS.length} trips.`)
  db.close()
}

main()
