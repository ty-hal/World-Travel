#!/usr/bin/env node
/**
 * Seed Lebanon & Cyprus, India, Sri Lanka, Pakistan, and Southern Africa itineraries
 * (dateless planned trips: days + places + covers). New trips are placed at the top of the
 * planned list (sort_order 0..4); existing trips are only refreshed (places + cover).
 * Usage: node scripts/seed-ty-lebanon-india-srilanka-pakistan-africa.mjs
 */
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../server/data/travel.db')
const USER_ID = 2

const H = 1, R = 2, A = 3, S = 4, T = 5, X = 6, C = 7, N = 9, O = 10
const B = 8 // beach

/** Prior titles → current titles (idempotent rename on re-seed). */
const RENAME = {
  'Lebanon & Cyprus': 'Lebanon & Cyprus: Phoenician Coast to Troodos',
  'India': 'India: Delhi to Ellora',
  'India: Ancient Cities, Forts & Temples': 'India: Delhi to Ellora',
  'Sri Lanka': 'Sri Lanka: Kingdoms, Highlands & Coast',
  'Pakistan': 'Pakistan: Indus Valley to Hunza',
}

const COVERS = {
  'Lebanon & Cyprus: Phoenician Coast to Troodos': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Lebanon%2C_Baalbek%2C_Temple_of_Bacchus_2.jpg/1920px-Lebanon%2C_Baalbek%2C_Temple_of_Bacchus_2.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Byblos_Castle%2C_Byblos%2C_Lebanon.jpg/1920px-Byblos_Castle%2C_Byblos%2C_Lebanon.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Harbour%2C_Kyrenia%2C_Northern_Cyprus_07.jpg/1920px-Harbour%2C_Kyrenia%2C_Northern_Cyprus_07.jpg',
  ],
  'India: Delhi to Ellora': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edit3.jpg/1920px-Taj_Mahal%2C_Agra%2C_India_edit3.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Jaipur_03-2016_02_Amber_Fort.jpg/1920px-Jaipur_03-2016_02_Amber_Fort.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Courtyard_and_Mahabharata_Reliefs_at_the_Kailasa_Temple%2C_Ellora_01.jpg/1920px-Courtyard_and_Mahabharata_Reliefs_at_the_Kailasa_Temple%2C_Ellora_01.jpg',
  ],
  'Sri Lanka: Kingdoms, Highlands & Coast': [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSMeno6JBIdN-EeqmTmm6v_wTW-H3hbw6NRD3sLgoVlOw&s=10',
    'https://upload.wikimedia.org/wikipedia/commons/7/78/Galle_Fort_wall_and_lighthouse.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Nine_Arches_Bridge_in_Ella.jpg/1920px-Nine_Arches_Bridge_in_Ella.jpg',
  ],
  'Pakistan: Indus Valley to Hunza': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Hunza_Valley%2C_view_from_Eagle%27s_Nest.jpg/1920px-Hunza_Valley%2C_view_from_Eagle%27s_Nest.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Baltit_Fort_Hunza_valley.jpg/1920px-Baltit_Fort_Hunza_valley.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/Clouds_in_the_Passu_Cones_-_Hunza_Valley.jpg/1920px-Clouds_in_the_Passu_Cones_-_Hunza_Valley.jpg',
  ],
  'Southern Africa: Cape Town to Victoria Falls': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Table_Mountain_DanieVDM.jpg/1920px-Table_Mountain_DanieVDM.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/African_bush_elephant_%28Loxodonta_africana%29_drinking_Kruger.jpg/1920px-African_bush_elephant_%28Loxodonta_africana%29_drinking_Kruger.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/0845_VictoriaFallsZimbabwe_19920803.jpg/1920px-0845_VictoriaFallsZimbabwe_19920803.jpg',
  ],
}

/** @type {{ title: string, currency: string, description: string, days: { title: string, notes: string }[], places: { n: string, c?: number, notes?: string, lat?: number, lng?: number }[][] }[]} */
const TRIPS = [
  // ───────────────────────── 1. Lebanon & Cyprus ─────────────────────────
  {
    title: 'Lebanon & Cyprus: Phoenician Coast to Troodos',
    currency: 'USD',
    description:
      '21 days: Lebanon (days 1–11) then Cyprus (days 12–21). Best Spring Apr–May or Fall Sep–Oct. Carry USD cash in Lebanon (cards/ATMs unreliable; small bills for taxis and entry fees). Beirut (BEY) → Larnaca (LCA) mid-trip flight on day 12. In Cyprus, the UN Green Line crossing in Nicosia is on foot with your passport (Ledra Street / Ledra Palace). Check current travel advisories for southern Lebanon and the Syrian border before booking; hire a local driver for Baalbek, Tyre and the Bekaa.',
    days: [
      { title: 'Arrive Beirut — Corniche & Pigeon Rocks', notes: 'Land BEY. Transfer to Hamra/Gemmayzeh hotel. Sunset walk along the Corniche to Raouché and Pigeon Rocks. Dinner in Mar Mikhael.' },
      { title: 'Beirut Historical Core', notes: 'National Museum of Beirut (Phoenician sarcophagi, ivories). Martyrs Square, Mohammad Al-Amin Mosque, Downtown Roman baths. Sursock Museum in the afternoon.' },
      { title: 'Jeita Grotto & Byblos', notes: 'Morning Jeita Grotto (upper and lower caves, boat ride). Afternoon Byblos: Crusader castle, Phoenician temples, old harbor and souk.' },
      { title: 'Harissa & Batroun', notes: 'Cable car (Téléférique) to Our Lady of Lebanon at Harissa. Continue north to Batroun: old town, Phoenician Wall, fresh lemonade, seafood dinner.' },
      { title: 'Chouf: Beiteddine & Al-Shouf Cedars', notes: 'Beiteddine Palace, Deir el-Qamar village, then Al-Shouf Cedar Nature Reserve at Maasser el-Shouf for a short cedar walk.' },
      { title: 'Baalbek', notes: 'Cross Mount Lebanon to the Bekaa. Temples of Jupiter and Bacchus, Stone of the Pregnant Woman quarry. Lunch in Baalbek; late return to Beirut.' },
      { title: 'Anjar & Bekaa Wine', notes: 'Umayyad city of Anjar (UNESCO). Wine tasting at Ksara (Roman-era caves) and Château Kefraya.' },
      { title: 'Qadisha Valley & Cedars of God', notes: 'Drive north to Bsharri. Gibran Museum, Qadisha (Holy) Valley monasteries, Qannoubine, and the Cedars of God grove.' },
      { title: 'Sidon', notes: 'South along the coast. Sidon Sea Castle, Khan al-Franj, souks, Soap Museum. Knefeh dessert stop.' },
      { title: 'Tyre', notes: 'Tyre (Sour) UNESCO sites: Al-Mina excavations, Roman Hippodrome and necropolis, Tyre Beach Nature Reserve. Hire a local driver; check conditions in the south before going.' },
      { title: 'Tripoli & Northern Coast', notes: 'Tripoli Citadel of Raymond de Saint-Gilles, Mamluk souks, Taynal Mosque, Hallab sweets. Return to Beirut for the final night in Lebanon.' },
      { title: 'Flight Beirut → Larnaca', notes: 'BEY → LCA (~45 min). Pick up rental car in Larnaca. Finikoudes promenade and seafood dinner. Keep passport/ID handy.' },
      { title: 'Larnaca & Kiti', notes: 'Church of Saint Lazarus, Hala Sultan Tekke by the Salt Lake (flamingos in winter), Kiti village with Panagia Angeloktisti Byzantine mosaics.' },
      { title: 'Kourion & Temple of Apollo', notes: 'Drive west along the coast. Kourion mosaics and Greco-Roman theatre, Sanctuary of Apollo Hylates, Kolossi Castle.' },
      { title: 'Paphos Archaeological Park', notes: 'Paphos (UNESCO): House of Dionysos mosaics, Odeon, Tombs of the Kings, Paphos Harbour Castle. Sunset on the waterfront.' },
      { title: 'Akamas & Aphrodite Rock', notes: 'Petra tou Romiou (Aphrodite\'s Rock) en route, then Akamas Peninsula: Baths of Aphrodite, Avakas Gorge hike, Lara Bay beach.' },
      { title: 'Troodos UNESCO Painted Churches', notes: 'Drive into Troodos massif. Panagia Forviotissa (Asinou), Agios Nikolaos tis Stegis, Panagia tou Araka (Lagoudera). Mount Olympus viewpoint.' },
      { title: 'Kakopetria & Omodos', notes: 'Kakopetria old village stroll and mill trail. Afternoon Omodos: Holy Cross monastery, wine and village lanes. Overnight in a mountain guesthouse.' },
      { title: 'Nicosia — The Divided Capital', notes: 'Venetian walls and Famagusta Gate. Cyprus Museum, Ledra Street, then cross the UN Green Line on foot with your passport (Ledra Street checkpoint). Selimiye Mosque in the north.' },
      { title: 'Salamis & Kyrenia', notes: 'Ancient Salamis ruins and Famagusta old city outskirts. Continue to Kyrenia: harbor, castle and Bellapais Abbey. Return across the Green Line (check rental-car insurance rules for the north).' },
      { title: 'Departure — Larnaca (optional Choirokoitia)', notes: 'Optional Choirokoitia Neolithic settlement (UNESCO) on the way. Return rental car; fly home from LCA.' },
    ],
    places: [
      [
        { n: 'Beirut–Rafic Hariri Airport (BEY)', c: T, notes: '[transport] Arrival; withdraw/exchange USD cash.', lat: 33.8209, lng: 35.4884 },
        { n: 'Hotel — Hamra / Gemmayzeh', c: H, notes: '[lodging] Base for three nights.', lat: 33.8938, lng: 35.5018 },
        { n: 'Beirut Corniche', c: N, notes: '[activity] Sunset seaside promenade.', lat: 33.8975, lng: 35.4770 },
        { n: 'Pigeon Rocks (Raouché)', c: A, notes: '[activity] Iconic sea stacks at Raouché.', lat: 33.8903, lng: 35.4707 },
        { n: 'Dinner in Mar Mikhael', c: R, notes: '[food] Lebanese mezze and arak.', lat: 33.8960, lng: 35.5230 },
      ],
      [
        { n: 'National Museum of Beirut', c: A, notes: '[activity] Phoenician sarcophagi, Roman statuary.', lat: 33.8786, lng: 35.5155 },
        { n: 'Martyrs Square', c: A, notes: '[activity] Heart of downtown Beirut.', lat: 33.8964, lng: 35.5068 },
        { n: 'Mohammad Al-Amin Mosque', c: A, notes: '[activity] Blue-domed mosque beside Roman remains.', lat: 33.8955, lng: 35.5059 },
        { n: 'Sursock Museum', c: A, notes: '[activity] Modern art in an Ottoman-era villa.', lat: 33.8956, lng: 35.5195 },
      ],
      [
        { n: 'Jeita Grotto', c: N, notes: '[activity] Limestone caves, upper gallery and boat ride.', lat: 33.9442, lng: 35.6414 },
        { n: 'Byblos Castle', c: A, notes: '[activity] Crusader fortress, one of the oldest inhabited cities.', lat: 34.1203, lng: 35.6485 },
        { n: 'Byblos Old Port & Souk', c: S, notes: '[activity] Harbor and stone alleys.', lat: 34.1210, lng: 35.6480 },
        { n: 'Seafood lunch at Byblos harbor', c: R, notes: '[food] Fresh catch by the port.', lat: 34.1208, lng: 35.6478 },
      ],
      [
        { n: 'Our Lady of Lebanon, Harissa', c: A, notes: '[activity] Téléférique ride and bay views.', lat: 33.9796, lng: 35.6511 },
        { n: 'Batroun Old Town', c: A, notes: '[activity] Souk, church and Greek Orthodox cathedral.', lat: 34.2554, lng: 35.6590 },
        { n: 'Phoenician Wall, Batroun', c: A, notes: '[activity] Ancient sea wall.', lat: 34.2580, lng: 35.6580 },
        { n: 'Batroun seafood dinner', c: R, notes: '[food] Fresh fish and lemonade.', lat: 34.2560, lng: 35.6600 },
      ],
      [
        { n: 'Beiteddine Palace', c: A, notes: '[activity] 19th-century Emir Bashir palace.', lat: 33.6942, lng: 35.5798 },
        { n: 'Deir el-Qamar', c: A, notes: '[activity] Historic Chouf village.', lat: 33.6958, lng: 35.5614 },
        { n: 'Al-Shouf Cedar Nature Reserve', c: N, notes: '[activity] Largest cedar reserve in Lebanon.', lat: 33.6914, lng: 35.7303 },
      ],
      [
        { n: 'Temple of Bacchus, Baalbek', c: A, notes: '[activity] Best-preserved Roman temple in the Levant.', lat: 34.0066, lng: 36.2043 },
        { n: 'Temple of Jupiter, Baalbek', c: A, notes: '[activity] Giant columns, UNESCO site.', lat: 34.0066, lng: 36.2040 },
        { n: 'Stone of the Pregnant Woman', c: A, notes: '[activity] Largest cut stone block, ~1,000 tons.', lat: 34.0001, lng: 36.2068 },
        { n: 'Lunch in Baalbek', c: R, notes: '[food] Local grills and sweets.', lat: 34.0069, lng: 36.2078 },
      ],
      [
        { n: 'Anjar (Umayyad city)', c: A, notes: '[activity] UNESCO 8th-century trading city.', lat: 33.7283, lng: 35.9337 },
        { n: 'Ksara Winery', c: C, notes: '[activity] Cave cellars tour and tasting.', lat: 33.8284, lng: 35.8932 },
        { n: 'Château Kefraya', c: C, notes: '[activity] Bekaa wine tasting.', lat: 33.6120, lng: 35.7570 },
      ],
      [
        { n: 'Gibran Museum, Bsharri', c: A, notes: '[activity] Monastery museum of Khalil Gibran.', lat: 34.2509, lng: 36.0108 },
        { n: 'Qadisha Valley', c: N, notes: '[activity] UNESCO Holy Valley monasteries and viewpoints.', lat: 34.2650, lng: 36.0300 },
        { n: 'Qannoubine Monastery', c: A, notes: '[activity] Cliffside patriarchal seat.', lat: 34.2850, lng: 35.9740 },
        { n: 'Cedars of God', c: N, notes: '[activity] Ancient cedar grove at ~1,900 m.', lat: 34.2436, lng: 36.0489 },
      ],
      [
        { n: 'Sidon Sea Castle', c: A, notes: '[activity] Crusader castle on a causeway.', lat: 33.5644, lng: 35.3687 },
        { n: 'Khan al-Franj', c: A, notes: '[activity] 17th-century caravanserai.', lat: 33.5668, lng: 35.3722 },
        { n: 'Sidon Soap Museum', c: A, notes: '[activity] Ottoman-era soap factory museum.', lat: 33.5694, lng: 35.3732 },
        { n: 'Sidon Old Souks & knefeh', c: S, notes: '[food] Sweets and street snacks.', lat: 33.5680, lng: 35.3710 },
      ],
      [
        { n: 'Tyre Al-Mina Archaeological Site', c: A, notes: '[activity] Phoenician port ruins.', lat: 33.2755, lng: 35.1938 },
        { n: 'Tyre Roman Hippodrome', c: A, notes: '[activity] One of the largest Roman hippodromes.', lat: 33.2690, lng: 35.2075 },
        { n: 'Tyre Beach Nature Reserve', c: B, notes: '[activity] Sandy coast and sea swim.', lat: 33.2600, lng: 35.2000 },
      ],
      [
        { n: 'Tripoli Citadel (Raymond de Saint-Gilles)', c: A, notes: '[activity] Crusader/Mamluk fortress.', lat: 34.4375, lng: 35.8450 },
        { n: 'Tripoli Mamluk Souks', c: S, notes: '[activity] Khans and craft alleys.', lat: 34.4380, lng: 35.8420 },
        { n: 'Taynal Mosque', c: A, notes: '[activity] 14th-century Mamluk mosque.', lat: 34.4385, lng: 35.8383 },
        { n: 'Hallab Sweets', c: R, notes: '[food] Famous Tripoli baklava and sweets.', lat: 34.4337, lng: 35.8420 },
      ],
      [
        { n: 'BEY → LCA', c: T, notes: '[transport] Flight Beirut → Larnaca ~45 min.', lat: 33.8209, lng: 35.4884 },
        { n: 'Larnaca International Airport (LCA)', c: T, notes: '[transport] Rental car pickup.', lat: 34.8751, lng: 33.6249 },
        { n: 'Hotel — Larnaca Finikoudes', c: H, notes: '[lodging] Seafront hotel.', lat: 34.9144, lng: 33.6380 },
        { n: 'Finikoudes Promenade', c: N, notes: '[activity] Palm-lined seafront.', lat: 34.9120, lng: 33.6385 },
      ],
      [
        { n: 'Church of Saint Lazarus', c: A, notes: '[activity] 9th-century church over the tomb of Lazarus.', lat: 34.9142, lng: 33.6354 },
        { n: 'Hala Sultan Tekke', c: A, notes: '[activity] Mosque on the Larnaca Salt Lake.', lat: 34.8870, lng: 33.6130 },
        { n: 'Larnaca Salt Lake', c: N, notes: '[activity] Flamingo watching in winter.', lat: 34.8830, lng: 33.6000 },
        { n: 'Panagia Angeloktisti, Kiti', c: A, notes: '[activity] Byzantine apse mosaic.', lat: 34.8310, lng: 33.5890 },
      ],
      [
        { n: 'Kourion Archaeological Site', c: A, notes: '[activity] Roman theatre and mosaic houses above the sea.', lat: 34.6643, lng: 32.8870 },
        { n: 'Sanctuary of Apollo Hylates', c: A, notes: '[activity] Temple complex west of Kourion.', lat: 34.6600, lng: 32.9100 },
        { n: 'Kolossi Castle', c: A, notes: '[activity] Crusader castle near Limassol.', lat: 34.6652, lng: 32.9300 },
        { n: 'Limassol Old Port', c: N, notes: '[activity] Evening stroll and dinner.', lat: 34.6700, lng: 33.0400 },
      ],
      [
        { n: 'Paphos Archaeological Park', c: A, notes: '[activity] UNESCO mosaics: House of Dionysos, Theseus.', lat: 34.7561, lng: 32.4047 },
        { n: 'Tombs of the Kings', c: A, notes: '[activity] Rock-cut Hellenistic tombs.', lat: 34.7753, lng: 32.4072 },
        { n: 'Paphos Harbour Castle', c: A, notes: '[activity] Medieval harbor fort.', lat: 34.7549, lng: 32.4056 },
        { n: 'Hotel — Paphos', c: H, notes: '[lodging] Base for two nights.', lat: 34.7570, lng: 32.4100 },
      ],
      [
        { n: 'Petra tou Romiou (Aphrodite\'s Rock)', c: A, notes: '[activity] Legendary birthplace of Aphrodite.', lat: 34.6643, lng: 32.6258 },
        { n: 'Baths of Aphrodite', c: N, notes: '[activity] Spring pool and nature trail.', lat: 35.0380, lng: 32.3600 },
        { n: 'Avakas Gorge', c: N, notes: '[activity] Limestone canyon walk.', lat: 34.9740, lng: 32.3470 },
        { n: 'Lara Bay', c: B, notes: '[activity] Turtle nesting beach.', lat: 34.9620, lng: 32.3140 },
      ],
      [
        { n: 'Panagia Forviotissa (Asinou)', c: A, notes: '[activity] UNESCO painted church.', lat: 35.0090, lng: 33.0260 },
        { n: 'Agios Nikolaos tis Stegis', c: A, notes: '[activity] UNESCO painted church.', lat: 34.9740, lng: 32.9970 },
        { n: 'Panagia tou Araka, Lagoudera', c: A, notes: '[activity] Byzantine frescoes.', lat: 35.0023, lng: 33.0120 },
        { n: 'Mount Olympus (Troodos)', c: N, notes: '[activity] Highest peak viewpoint.', lat: 34.9333, lng: 32.8644 },
      ],
      [
        { n: 'Kakopetria Old Village', c: A, notes: '[activity] Stone houses and mountain stream.', lat: 34.9887, lng: 32.9035 },
        { n: 'Omodos Village', c: A, notes: '[activity] Wine village and monastery.', lat: 34.8497, lng: 32.8122 },
        { n: 'Timios Stavros Monastery, Omodos', c: A, notes: '[activity] Monastery on the main square.', lat: 34.8495, lng: 32.8125 },
        { n: 'Kykkos Monastery', c: A, notes: '[activity] Richest monastery on the island.', lat: 34.9843, lng: 32.7403 },
      ],
      [
        { n: 'Venetian Walls & Famagusta Gate', c: A, notes: '[activity] Nicosia fortifications.', lat: 35.1750, lng: 33.3705 },
        { n: 'Cyprus Museum', c: A, notes: '[activity] Island archaeology collection.', lat: 35.1712, lng: 33.3560 },
        { n: 'Ledra Street Crossing', c: X, notes: '[activity] UN Green Line crossing on foot; passport required.', lat: 35.1722, lng: 33.3627 },
        { n: 'Selimiye Mosque', c: A, notes: '[activity] Former St. Sophia Cathedral (north Nicosia).', lat: 35.1750, lng: 33.3650 },
      ],
      [
        { n: 'Salamis Ancient City', c: A, notes: '[activity] Gymnasium and Roman baths by the sea.', lat: 35.1850, lng: 33.9013 },
        { n: 'Lala Mustafa Pasha Mosque (Famagusta)', c: A, notes: '[activity] Former St. Nicholas Cathedral.', lat: 35.1250, lng: 33.9400 },
        { n: 'Kyrenia Harbour', c: N, notes: '[activity] Postcard harbor and waterfront dinner.', lat: 35.3414, lng: 33.3200 },
        { n: 'Kyrenia Castle', c: A, notes: '[activity] Byzantine/Venetian fortress.', lat: 35.3414, lng: 33.3228 },
        { n: 'Bellapais Abbey', c: A, notes: '[activity] Gothic abbey in the hills.', lat: 35.3050, lng: 33.3550 },
      ],
      [
        { n: 'Choirokoitia Neolithic Settlement', c: A, notes: '[activity] Optional UNESCO stop on the way (~7000 BC).', lat: 34.7992, lng: 33.3438 },
        { n: 'Larnaca Airport (LCA)', c: T, notes: '[transport] Return car; depart.', lat: 34.8751, lng: 33.6249 },
      ],
    ],
  },

  // ───────────────────────── 2. India ─────────────────────────
  {
    title: 'India: Delhi to Ellora',
    currency: 'INR',
    description:
      '21 days, ~$2,200 in-country (hotels, trains, internal flights, entry fees, food). Delhi (1–3) → Jaipur (4–5) → Agra (6–7) → Gwalior / Orchha / Khajuraho (8–10) → Varanasi (11–13) → Ajanta / Ellora / Aurangabad (14–16) → Mumbai (17–21). Best Oct–Mar. Book Vande Bharat / Shatabdi trains and internal flights early. Taj Mahal is closed Fridays; Ajanta closed Mondays, Ellora closed Tuesdays.',
    days: [
      { title: 'Arrive Delhi', notes: 'Land DEL. Hotel near Connaught Place. Evening India Gate and a gentle first dinner.' },
      { title: 'Old Delhi', notes: 'Red Fort, Jama Masjid, Chandni Chowk food walk (rickshaw), Raj Ghat.' },
      { title: 'New Delhi & Mughal Monuments', notes: 'Humayun\'s Tomb, Lodhi Gardens, Qutub Minar, Lotus Temple at sunset.' },
      { title: 'Train to Jaipur — Pink City', notes: 'Morning train to Jaipur. Hawa Mahal, City Palace, Jantar Mantar. Evening Johari Bazaar.' },
      { title: 'Amber Fort & Hill Forts', notes: 'Amber Fort early, Jaigarh Fort, Nahargarh sunset viewpoint.' },
      { title: 'Fatehpur Sikri to Agra', notes: 'Drive to Agra via Fatehpur Sikri. Agra Fort and Mehtab Bagh Taj view at sunset.' },
      { title: 'Taj Mahal Sunrise & Agra Tombs', notes: 'Taj Mahal at sunrise (closed Fridays). Itimad-ud-Daulah, Akbar\'s Tomb at Sikandra, Kinari Bazaar.' },
      { title: 'Gwalior', notes: 'Train to Gwalior. Gwalior Fort, Teli ka Mandir, Sas-Bahu temples, Jai Vilas Palace.' },
      { title: 'Orchha', notes: 'Drive to Orchha. Jahangir Mahal, Ram Raja Temple, Chaturbhuj Temple, royal cenotaphs on the Betwa River.' },
      { title: 'Khajuraho', notes: 'Western Group temples (Kandariya Mahadeva), Eastern Group, ASI museum. Evening sound-and-light show.' },
      { title: 'Fly to Varanasi — Ganga Aarti', notes: 'Fly Khajuraho → Varanasi. Old City lanes, Kashi Vishwanath area, Dashashwamedh Ghat evening aarti.' },
      { title: 'Sunrise Boat & Sarnath', notes: 'Dawn boat on the Ganges past burning ghats. Sarnath: Dhamek Stupa and museum.' },
      { title: 'Varanasi — Silk, Temples & Ghats', notes: 'Ramnagar Fort, Banaras Hindu University, Tulsi Manas Temple, Assi Ghat evening.' },
      { title: 'Fly to Aurangabad', notes: 'Fly to Aurangabad. Bibi Ka Maqbara (mini Taj), Panchakki, Daulatabad Fort.' },
      { title: 'Ajanta Caves', notes: 'Full day at Ajanta: Buddhist cave paintings and sculpture (closed Mondays).' },
      { title: 'Ellora Caves & Kailasa Temple', notes: 'Kailasa Temple (Cave 16), Buddhist and Jain caves, Grishneshwar Temple (closed Tuesdays).' },
      { title: 'Fly to Mumbai', notes: 'Fly Aurangabad → Mumbai. CSMT, Gateway of India, Taj Mahal Palace exterior, Colaba Causeway.' },
      { title: 'Elephanta & Marine Drive', notes: 'Ferry to Elephanta Island rock-cut caves. Marine Drive and Chowpatty at sunset.' },
      { title: 'Museums, Dhobi Ghat & Haji Ali', notes: 'Chhatrapati Shivaji Maharaj Vastu Sangrahalaya, Crawford Market, Dhobi Ghat, Haji Ali Dargah.' },
      { title: 'Kanheri Caves & Bandra', notes: 'Kanheri Buddhist caves in Sanjay Gandhi National Park. Afternoon Bandra Fort, street art, bandstand.' },
      { title: 'Last Morning & Departure', notes: 'Final chai and bazaar stroll (Kala Ghoda / Sassoon Dock). Fly home from BOM.' },
    ],
    places: [
      [
        { n: 'Indira Gandhi International Airport (DEL)', c: T, notes: '[transport] Arrival; prepaid taxi or Metro Airport Express.', lat: 28.5562, lng: 77.1000 },
        { n: 'Hotel — Connaught Place', c: H, notes: '[lodging] Central Delhi base.', lat: 28.6315, lng: 77.2167 },
        { n: 'India Gate', c: A, notes: '[activity] War memorial and evening promenade.', lat: 28.6129, lng: 77.2295 },
      ],
      [
        { n: 'Red Fort (Lal Qila)', c: A, notes: '[activity] UNESCO Mughal fortress.', lat: 28.6562, lng: 77.2410 },
        { n: 'Jama Masjid', c: A, notes: '[activity] Largest mosque in India.', lat: 28.6507, lng: 77.2334 },
        { n: 'Chandni Chowk', c: S, notes: '[food] Parathas, jalebi and chaat.', lat: 28.6560, lng: 77.2300 },
        { n: 'Raj Ghat', c: A, notes: '[activity] Gandhi memorial.', lat: 28.6411, lng: 77.2490 },
      ],
      [
        { n: 'Humayun\'s Tomb', c: A, notes: '[activity] UNESCO garden tomb, precursor to the Taj.', lat: 28.5933, lng: 77.2507 },
        { n: 'Lodhi Gardens', c: N, notes: '[activity] Sayyid and Lodi tombs in a park.', lat: 28.5931, lng: 77.2197 },
        { n: 'Qutub Minar', c: A, notes: '[activity] UNESCO 73 m victory tower.', lat: 28.5245, lng: 77.1855 },
        { n: 'Lotus Temple', c: A, notes: '[activity] Baháʼí House of Worship.', lat: 28.5535, lng: 77.2588 },
      ],
      [
        { n: 'Jaipur Junction', c: T, notes: '[transport] Train Delhi → Jaipur (~4.5 h).', lat: 26.9196, lng: 75.7878 },
        { n: 'Hawa Mahal', c: A, notes: '[activity] Palace of Winds facade.', lat: 26.9239, lng: 75.8267 },
        { n: 'City Palace, Jaipur', c: A, notes: '[activity] Royal residence and museum.', lat: 26.9258, lng: 75.8237 },
        { n: 'Jantar Mantar, Jaipur', c: A, notes: '[activity] UNESCO astronomical instruments.', lat: 26.9247, lng: 75.8246 },
        { n: 'Johari Bazaar', c: S, notes: '[shopping] Jewelry and textiles.', lat: 26.9190, lng: 75.8260 },
      ],
      [
        { n: 'Amber Fort', c: A, notes: '[activity] Hilltop fort-palace; go early.', lat: 26.9855, lng: 75.8513 },
        { n: 'Jaigarh Fort', c: A, notes: '[activity] Cannon foundry and ramparts.', lat: 26.9853, lng: 75.8432 },
        { n: 'Nahargarh Fort', c: A, notes: '[activity] Sunset city views.', lat: 26.9373, lng: 75.8153 },
        { n: 'Panna Meena ka Kund', c: A, notes: '[activity] Geometric stepwell near Amber.', lat: 26.9880, lng: 75.8530 },
      ],
      [
        { n: 'Fatehpur Sikri', c: A, notes: '[activity] UNESCO abandoned Mughal capital.', lat: 27.0940, lng: 77.6679 },
        { n: 'Agra Fort', c: A, notes: '[activity] UNESCO red sandstone fort.', lat: 27.1795, lng: 78.0211 },
        { n: 'Mehtab Bagh', c: N, notes: '[activity] Sunset view of the Taj across the Yamuna.', lat: 27.1791, lng: 78.0447 },
        { n: 'Hotel — Agra', c: H, notes: '[lodging] Near Taj East Gate.', lat: 27.1700, lng: 78.0400 },
      ],
      [
        { n: 'Taj Mahal (sunrise)', c: A, notes: '[activity] Closed Fridays; arrive at opening.', lat: 27.1751, lng: 78.0421 },
        { n: 'Itimad-ud-Daulah', c: A, notes: '[activity] "Baby Taj" jewel-box tomb.', lat: 27.1928, lng: 78.0301 },
        { n: 'Akbar\'s Tomb, Sikandra', c: A, notes: '[activity] Mughal tomb in a garden.', lat: 27.2203, lng: 77.9511 },
        { n: 'Kinari Bazaar', c: S, notes: '[shopping] Marble inlay and sweets.', lat: 27.1830, lng: 78.0150 },
      ],
      [
        { n: 'Gwalior Fort', c: A, notes: '[activity] Hilltop fort with Man Mandir Palace.', lat: 26.2306, lng: 78.1692 },
        { n: 'Teli ka Mandir', c: A, notes: '[activity] 8th-century Pratihara temple.', lat: 26.2293, lng: 78.1685 },
        { n: 'Sas-Bahu Temples', c: A, notes: '[activity] 11th-century twin temples.', lat: 26.2300, lng: 78.1680 },
        { n: 'Jai Vilas Palace', c: A, notes: '[activity] Scindia palace museum.', lat: 26.2152, lng: 78.1655 },
      ],
      [
        { n: 'Orchha Fort Complex', c: A, notes: '[activity] Raj Mahal and Jahangir Mahal.', lat: 25.3513, lng: 78.6401 },
        { n: 'Jahangir Mahal', c: A, notes: '[activity] Bundela palace.', lat: 25.3511, lng: 78.6407 },
        { n: 'Ram Raja Temple', c: A, notes: '[activity] Palace-turned-temple.', lat: 25.3508, lng: 78.6411 },
        { n: 'Chaturbhuj Temple', c: A, notes: '[activity] Tall Bundela temple.', lat: 25.3504, lng: 78.6408 },
        { n: 'Orchha Cenotaphs (Chhatris)', c: N, notes: '[activity] Betwa river sunset.', lat: 25.3465, lng: 78.6420 },
      ],
      [
        { n: 'Khajuraho Western Group', c: A, notes: '[activity] UNESCO Chandela temples.', lat: 24.8519, lng: 79.9199 },
        { n: 'Kandariya Mahadeva Temple', c: A, notes: '[activity] Largest Khajuraho temple.', lat: 24.8517, lng: 79.9200 },
        { n: 'Khajuraho Eastern Group (Jain)', c: A, notes: '[activity] Parsvanatha and Jain temples.', lat: 24.8460, lng: 79.9331 },
        { n: 'Khajuraho sound & light show', c: X, notes: '[activity] Evening show at Western Group.', lat: 24.8519, lng: 79.9199 },
      ],
      [
        { n: 'Lal Bahadur Shastri Airport (VNS)', c: T, notes: '[transport] Fly KHJ → VNS.', lat: 25.4524, lng: 82.8593 },
        { n: 'Hotel — Assi Ghat', c: H, notes: '[lodging] Walkable to the ghats.', lat: 25.2882, lng: 83.0063 },
        { n: 'Kashi Vishwanath Corridor', c: A, notes: '[activity] Temple precinct and Old City lanes.', lat: 25.3109, lng: 83.0107 },
        { n: 'Dashashwamedh Ghat Ganga Aarti', c: A, notes: '[activity] Evening fire ceremony.', lat: 25.3076, lng: 83.0107 },
      ],
      [
        { n: 'Sunrise boat on the Ganges', c: X, notes: '[activity] Assi to Manikarnika.', lat: 25.2882, lng: 83.0063 },
        { n: 'Manikarnika Ghat', c: A, notes: '[activity] Main cremation ghat (observe respectfully).', lat: 25.3109, lng: 83.0140 },
        { n: 'Dhamek Stupa, Sarnath', c: A, notes: '[activity] Where the Buddha gave his first sermon.', lat: 25.3811, lng: 83.0227 },
        { n: 'Sarnath Archaeological Museum', c: A, notes: '[activity] Lion Capital of Ashoka.', lat: 25.3817, lng: 83.0229 },
      ],
      [
        { n: 'Ramnagar Fort', c: A, notes: '[activity] Maharaja of Benares\' fort across the river.', lat: 25.2689, lng: 83.0287 },
        { n: 'Banaras Hindu University', c: A, notes: '[activity] Vishwanath Temple and campus.', lat: 25.2677, lng: 82.9913 },
        { n: 'Tulsi Manas Temple', c: A, notes: '[activity] Marble temple of the Ramcharitmanas.', lat: 25.2910, lng: 82.9990 },
        { n: 'Banarasi silk weavers', c: S, notes: '[shopping] Silk workshops near Madanpura.', lat: 25.3150, lng: 83.0160 },
      ],
      [
        { n: 'Aurangabad Airport (IXU)', c: T, notes: '[transport] Fly VNS → Aurangabad (connection).', lat: 19.8627, lng: 75.3981 },
        { n: 'Bibi Ka Maqbara', c: A, notes: '[activity] "Mini Taj" of the Deccan.', lat: 19.9019, lng: 75.3200 },
        { n: 'Panchakki', c: A, notes: '[activity] 17th-century water-mill complex.', lat: 19.9140, lng: 75.3250 },
        { n: 'Daulatabad Fort', c: A, notes: '[activity] Spiral dark passage and hilltop citadel.', lat: 19.9427, lng: 75.2132 },
      ],
      [
        { n: 'Ajanta Caves', c: A, notes: '[activity] UNESCO Buddhist cave murals; closed Mondays.', lat: 20.5519, lng: 75.7033 },
        { n: 'Ajanta Viewpoint', c: N, notes: '[activity] Horseshoe gorge panorama.', lat: 20.5530, lng: 75.7020 },
        { n: 'Hotel — Aurangabad', c: H, notes: '[lodging] Base for Ellora.', lat: 19.8762, lng: 75.3433 },
      ],
      [
        { n: 'Kailasa Temple (Cave 16), Ellora', c: A, notes: '[activity] Monolithic temple carved from one rock.', lat: 20.0268, lng: 75.1790 },
        { n: 'Ellora Buddhist Caves', c: A, notes: '[activity] Vishvakarma Cave (Cave 10).', lat: 20.0270, lng: 75.1770 },
        { n: 'Ellora Jain Caves', c: A, notes: '[activity] Indra Sabha caves.', lat: 20.0330, lng: 75.1820 },
        { n: 'Grishneshwar Temple', c: A, notes: '[activity] Jyotirlinga shrine near Ellora.', lat: 20.0242, lng: 75.1695 },
      ],
      [
        { n: 'Mumbai Chhatrapati Shivaji Airport (BOM)', c: T, notes: '[transport] Fly Aurangabad → Mumbai.', lat: 19.0896, lng: 72.8656 },
        { n: 'Chhatrapati Shivaji Terminus (CSMT)', c: A, notes: '[activity] UNESCO Victorian Gothic station.', lat: 18.9398, lng: 72.8355 },
        { n: 'Gateway of India', c: A, notes: '[activity] Harbor arch and ferry point.', lat: 18.9220, lng: 72.8347 },
        { n: 'Colaba Causeway', c: S, notes: '[shopping] Street shops and cafes.', lat: 18.9156, lng: 72.8260 },
        { n: 'Hotel — Colaba', c: H, notes: '[lodging] Mumbai base for five nights.', lat: 18.9190, lng: 72.8330 },
      ],
      [
        { n: 'Elephanta Caves', c: A, notes: '[activity] Ferry from Gateway of India; Trimurti sculpture.', lat: 18.9633, lng: 72.9315 },
        { n: 'Marine Drive', c: N, notes: '[activity] Queen\'s Necklace promenade.', lat: 18.9440, lng: 72.8230 },
        { n: 'Girgaum Chowpatty', c: N, notes: '[food] Bhel puri and sunset.', lat: 18.9548, lng: 72.8130 },
      ],
      [
        { n: 'Chhatrapati Shivaji Maharaj Vastu Sangrahalaya', c: A, notes: '[activity] Prince of Wales Museum.', lat: 18.9269, lng: 72.8326 },
        { n: 'Crawford Market', c: S, notes: '[shopping] Spices, fruit and sundries.', lat: 18.9477, lng: 72.8340 },
        { n: 'Dhobi Ghat', c: A, notes: '[activity] Open-air laundry.', lat: 18.9820, lng: 72.8250 },
        { n: 'Haji Ali Dargah', c: A, notes: '[activity] Islamic shrine on a causeway.', lat: 18.9827, lng: 72.8089 },
      ],
      [
        { n: 'Kanheri Caves', c: A, notes: '[activity] Buddhist caves in Sanjay Gandhi National Park.', lat: 19.2058, lng: 72.9060 },
        { n: 'Bandra Fort', c: A, notes: '[activity] Sea fort and bay views.', lat: 19.0428, lng: 72.8187 },
        { n: 'Bandra Bandstand', c: N, notes: '[activity] Sunset promenade.', lat: 19.0420, lng: 72.8190 },
        { n: 'Farewell dinner in Bandra', c: R, notes: '[food] Final thali or seafood.', lat: 19.0600, lng: 72.8300 },
      ],
      [
        { n: 'Sassoon Dock', c: A, notes: '[activity] Morning fish-market photography (optional).', lat: 18.9065, lng: 72.8185 },
        { n: 'Kala Ghoda Art District', c: S, notes: '[activity] Last-minute gifts and cafes.', lat: 18.9280, lng: 72.8320 },
        { n: 'BOM → Home', c: T, notes: '[transport] Depart Mumbai.', lat: 19.0896, lng: 72.8656 },
      ],
    ],
  },

  // ───────────────────────── 3. Sri Lanka ─────────────────────────
  {
    title: 'Sri Lanka: Kingdoms, Highlands & Coast',
    currency: 'LKR',
    description:
      '15 days: Anuradhapura (1–3) → Sigiriya / Polonnaruwa (4–6) → Dambulla / Kandy (7–8) → Highlands, Ella & Yala (9–11) → Galle / Colombo (12–15). Cultural Triangle Dec–Apr is dry; south and west coasts best Dec–Apr; whale watching off Mirissa Nov–Apr. Scenic train Kandy → Ella needs reserved seats booked weeks ahead. Buy a local SIM at CMB and use PickMe/Uber in Colombo.',
    days: [
      { title: 'Arrive Colombo → Anuradhapura', notes: 'Land CMB, drive or train north to Anuradhapura (~4–5 h). Sri Maha Bodhi tree and Ruwanwelisaya at dusk.' },
      { title: 'Anuradhapura Ancient City', notes: 'Jetavanaramaya, Abhayagiri monastery, Isurumuniya Vihara, Samadhi Buddha. Rent a bike or tuk-tuk.' },
      { title: 'Mihintale & Anuradhapura Ruins', notes: 'Climb Mihintale (1,840 steps). Afternoon Thuparamaya, Kuttam Pokuna (twin ponds).' },
      { title: 'Sigiriya Rock', notes: 'Early Sigiriya Lion Rock (frescoes, mirror wall), then Pidurangala for sunset views of Sigiriya.' },
      { title: 'Polonnaruwa', notes: 'Polonnaruwa Quadrangle, Royal Palace, Gal Vihara Buddhas. Cycle Parakrama Samudra shore.' },
      { title: 'Minneriya Elephant Safari', notes: 'Jeep safari at Minneriya (Gathering Jun–Oct) or Kaudulla. Village lunch near Habarana.' },
      { title: 'Dambulla Cave Temple & Spice Gardens', notes: 'Dambulla Royal Rock Temple, spice garden in Matale, Aluvihara rock temple, arrive Kandy.' },
      { title: 'Kandy', notes: 'Temple of the Tooth, Kandy Lake, Royal Botanic Gardens Peradeniya, Kandyan dance show.' },
      { title: 'Hill Country Train & Tea', notes: 'Train Kandy → Nanu Oya (reserved 2nd/3rd class). Pedro Tea Estate, Gregory Lake, Nuwara Eliya.' },
      { title: 'Ella — Nine Arches Bridge', notes: 'Train Nanu Oya → Ella. Nine Arches Bridge, Little Adam\'s Peak, Ravana Falls.' },
      { title: 'Yala National Park Safari', notes: 'Drive Ella → Tissamaharama. Afternoon jeep safari in Yala for leopards, elephants and birds.' },
      { title: 'Galle Fort', notes: 'Drive to Galle. Dutch Fort walls, Lighthouse, Dutch Reformed Church, Unawatuna beach.' },
      { title: 'Mirissa & Southern Coast', notes: 'Mirissa Beach, Coconut Tree Hill, Weligama bay. Whale watching Nov–Apr (morning).' },
      { title: 'Colombo', notes: 'Gangaramaya Temple, Pettah Market, Jami Ul-Alfar Mosque, National Museum, Galle Face Green sunset.' },
      { title: 'Departure', notes: 'Seema Malaka on Beira Lake, souvenir run, airport transfer to CMB.' },
    ],
    places: [
      [
        { n: 'Bandaranaike International Airport (CMB)', c: T, notes: '[transport] Arrival; SIM and cash.', lat: 7.1808, lng: 79.8841 },
        { n: 'Sri Maha Bodhi', c: A, notes: '[activity] Sacred fig tree from 288 BC.', lat: 8.3453, lng: 80.3969 },
        { n: 'Ruwanwelisaya', c: A, notes: '[activity] Great white stupa.', lat: 8.3510, lng: 80.3963 },
        { n: 'Hotel — Anuradhapura', c: H, notes: '[lodging] Base for two nights.', lat: 8.3350, lng: 80.4100 },
      ],
      [
        { n: 'Jetavanaramaya', c: A, notes: '[activity] Massive brick stupa.', lat: 8.3515, lng: 80.4070 },
        { n: 'Abhayagiri Monastery', c: A, notes: '[activity] Ancient monastery complex and Samadhi statue nearby.', lat: 8.3687, lng: 80.4030 },
        { n: 'Isurumuniya Vihara', c: A, notes: '[activity] Rock temple with Lovers carving.', lat: 8.3333, lng: 80.4080 },
        { n: 'Samadhi Buddha Statue', c: A, notes: '[activity] Meditating Buddha in the Mahamevnawa Park.', lat: 8.3607, lng: 80.3975 },
      ],
      [
        { n: 'Mihintale', c: A, notes: '[activity] Where Buddhism arrived in Sri Lanka.', lat: 8.3507, lng: 80.5083 },
        { n: 'Kuttam Pokuna (Twin Ponds)', c: A, notes: '[activity] Ancient monastic bathing ponds.', lat: 8.3600, lng: 80.4030 },
        { n: 'Thuparamaya', c: A, notes: '[activity] Oldest dagoba in Sri Lanka.', lat: 8.3520, lng: 80.3978 },
      ],
      [
        { n: 'Sigiriya Rock', c: A, notes: '[activity] UNESCO "Lion Rock" fortress and frescoes.', lat: 7.9570, lng: 80.7603 },
        { n: 'Sigiriya Museum', c: A, notes: '[activity] Context before the climb.', lat: 7.9490, lng: 80.7570 },
        { n: 'Pidurangala Rock', c: N, notes: '[activity] Sunset view of Sigiriya.', lat: 7.9660, lng: 80.7590 },
        { n: 'Hotel — Sigiriya', c: H, notes: '[lodging] Two nights.', lat: 7.9500, lng: 80.7600 },
      ],
      [
        { n: 'Polonnaruwa Quadrangle', c: A, notes: '[activity] Vatadage and sacred relics.', lat: 7.9440, lng: 81.0020 },
        { n: 'Polonnaruwa Royal Palace', c: A, notes: '[activity] Parakramabahu\'s palace ruins.', lat: 7.9400, lng: 81.0020 },
        { n: 'Gal Vihara', c: A, notes: '[activity] Rock-cut Buddhas.', lat: 7.9684, lng: 81.0027 },
        { n: 'Parakrama Samudra', c: N, notes: '[activity] Giant reservoir shoreline.', lat: 7.9300, lng: 81.0100 },
      ],
      [
        { n: 'Minneriya National Park', c: N, notes: '[activity] Elephant gathering (Jun–Oct).', lat: 8.0360, lng: 80.8960 },
        { n: 'Kaudulla National Park', c: N, notes: '[activity] Alternative safari when Minneriya is dry.', lat: 8.1000, lng: 80.9500 },
        { n: 'Village lunch, Habarana', c: R, notes: '[food] Rice and curry cooking class.', lat: 8.0420, lng: 80.7570 },
      ],
      [
        { n: 'Dambulla Cave Temple', c: A, notes: '[activity] UNESCO painted caves.', lat: 7.8567, lng: 80.6490 },
        { n: 'Golden Temple of Dambulla', c: A, notes: '[activity] Giant gilded Buddha facade.', lat: 7.8570, lng: 80.6510 },
        { n: 'Aluvihara Rock Temple', c: A, notes: '[activity] Site of the Pali canon first written.', lat: 7.5090, lng: 80.6360 },
        { n: 'Matale Spice Garden', c: S, notes: '[activity] Spice and ayurveda gardens.', lat: 7.4670, lng: 80.6240 },
      ],
      [
        { n: 'Temple of the Tooth', c: A, notes: '[activity] Sri Dalada Maligawa, UNESCO.', lat: 7.2936, lng: 80.6413 },
        { n: 'Kandy Lake', c: N, notes: '[activity] Lakeside walk.', lat: 7.2933, lng: 80.6420 },
        { n: 'Royal Botanic Gardens, Peradeniya', c: N, notes: '[activity] Orchids and giant bamboo.', lat: 7.2689, lng: 80.5963 },
        { n: 'Kandyan dance show', c: X, notes: '[activity] Evening cultural show.', lat: 7.2930, lng: 80.6370 },
      ],
      [
        { n: 'Kandy Railway Station', c: T, notes: '[transport] Scenic train to Nanu Oya.', lat: 7.2897, lng: 80.6348 },
        { n: 'Nanu Oya Station', c: T, notes: '[transport] Gateway to Nuwara Eliya.', lat: 6.9393, lng: 80.7031 },
        { n: 'Pedro Tea Estate', c: A, notes: '[activity] Factory tour and tea tasting.', lat: 6.9700, lng: 80.7800 },
        { n: 'Gregory Lake', c: N, notes: '[activity] Nuwara Eliya lakeside.', lat: 6.9660, lng: 80.7710 },
      ],
      [
        { n: 'Ella Railway Station', c: T, notes: '[transport] Hill-country line to Ella.', lat: 6.8667, lng: 81.0466 },
        { n: 'Nine Arches Bridge', c: A, notes: '[activity] Colonial-era viaduct; photograph a passing train.', lat: 6.8764, lng: 81.0600 },
        { n: 'Little Adam\'s Peak', c: N, notes: '[activity] Easy sunrise hike.', lat: 6.8735, lng: 81.0490 },
        { n: 'Ravana Falls', c: N, notes: '[activity] Roadside waterfall.', lat: 6.8394, lng: 81.0460 },
      ],
      [
        { n: 'Tissamaharama', c: H, notes: '[lodging] Overnight base for Yala.', lat: 6.2830, lng: 81.2840 },
        { n: 'Yala National Park', c: N, notes: '[activity] Jeep safari for leopards and elephants.', lat: 6.3720, lng: 81.5190 },
        { n: 'Kirinda Temple', c: A, notes: '[activity] Coastal temple stop.', lat: 6.2300, lng: 81.3100 },
      ],
      [
        { n: 'Galle Fort', c: A, notes: '[activity] UNESCO Dutch colonial ramparts.', lat: 6.0267, lng: 80.2170 },
        { n: 'Galle Lighthouse', c: A, notes: '[activity] Sunset on the walls.', lat: 6.0242, lng: 80.2160 },
        { n: 'Dutch Reformed Church, Galle', c: A, notes: '[activity] 1755 church.', lat: 6.0270, lng: 80.2165 },
        { n: 'Unawatuna Beach', c: B, notes: '[activity] Swim and seafood.', lat: 6.0100, lng: 80.2495 },
      ],
      [
        { n: 'Mirissa Beach', c: B, notes: '[activity] Whale-watch departures Nov–Apr.', lat: 5.9483, lng: 80.4716 },
        { n: 'Coconut Tree Hill, Mirissa', c: N, notes: '[activity] Iconic headland.', lat: 5.9437, lng: 80.4570 },
        { n: 'Weligama Bay', c: B, notes: '[activity] Surf and stilt fishing area.', lat: 5.9740, lng: 80.4290 },
      ],
      [
        { n: 'Gangaramaya Temple', c: A, notes: '[activity] Eclectic Buddhist temple.', lat: 6.9167, lng: 79.8555 },
        { n: 'Pettah Market', c: S, notes: '[shopping] Dense market district.', lat: 6.9340, lng: 79.8510 },
        { n: 'Jami Ul-Alfar Mosque', c: A, notes: '[activity] Red-and-white Red Mosque.', lat: 6.9370, lng: 79.8500 },
        { n: 'Colombo National Museum', c: A, notes: '[activity] Kandyan regalia.', lat: 6.9110, lng: 79.8610 },
        { n: 'Galle Face Green', c: N, notes: '[food] Sunset street food.', lat: 6.9270, lng: 79.8450 },
      ],
      [
        { n: 'Seema Malaka Temple, Beira Lake', c: A, notes: '[activity] Lake temple designed by Geoffrey Bawa.', lat: 6.9170, lng: 79.8570 },
        { n: 'Colombo Lotus Tower', c: A, notes: '[activity] Optional view.', lat: 6.9272, lng: 79.8584 },
        { n: 'CMB → Home', c: T, notes: '[transport] Depart.', lat: 7.1808, lng: 79.8841 },
      ],
    ],
  },

  // ───────────────────────── 4. Pakistan ─────────────────────────
  {
    title: 'Pakistan: Indus Valley to Hunza',
    currency: 'PKR',
    description:
      '14 days: Lahore (1–3) → Harappa (4) → Islamabad via Salt Range (5) → Taxila (6) → Peshawar (7) → Hunza (8–11) → return Islamabad (12) → optional Mohenjo-daro (13) → depart (14). SAFETY: the US State Department rates Pakistan Level 3 (Reconsider Travel) with higher-risk areas in Khyber Pakhtunkhwa and Balochistan — verify the current advisory, use a licensed local operator/driver, register trips with your embassy, and skip Peshawar or Mohenjo-daro if conditions change. Best May–Sept for Hunza; Khunjerab Pass road is usually open Apr 1–Nov 30 and permits vary. Carry cash PKR; cards are rare outside big hotels.',
    days: [
      { title: 'Arrive Lahore', notes: 'Land LHE. Hotel near the Walled City. Evening Lahore Fort and Badshahi Mosque at sunset; Food Street dinner.' },
      { title: 'Walled City & Mughal Gardens', notes: 'Wazir Khan Mosque, Shahi Hammam, Delhi Gate, Anarkali Bazaar. Afternoon Shalimar Gardens.' },
      { title: 'Lahore Museum & Wagah Border', notes: 'Lahore Museum, Jahangir\'s Tomb, Minar-e-Pakistan. Late afternoon Wagah border flag ceremony.' },
      { title: 'Harappa', notes: 'Drive to Harappa (~3.5 h). Indus Valley Civilization site and site museum. Overnight in Sahiwal/Faisalabad.' },
      { title: 'Salt Range to Islamabad', notes: 'Khewra Salt Mine, Katas Raj temples, Rohtas Fort en route. Arrive Islamabad; Faisal Mosque at sunset.' },
      { title: 'Taxila', notes: 'UNESCO Gandhara: Taxila Museum, Dharmarajika Stupa, Sirkap, Jaulian monastery. Evening Daman-e-Koh.' },
      { title: 'Peshawar', notes: 'Peshawar Museum, Qissa Khwani Bazaar, Mahabat Khan Mosque, Bala Hisar Fort exterior. Optional Takht-i-Bahi. Check conditions first.' },
      { title: 'Fly/Drive to Hunza', notes: 'Fly Islamabad → Gilgit (weather permitting) or take the KKH. Kargah Buddha, Rakaposhi viewpoint, arrive Karimabad.' },
      { title: 'Karimabad: Baltit & Altit', notes: 'Baltit Fort, Altit Fort, Eagle\'s Nest viewpoint at sunset. Walk the old Karimabad bazaar.' },
      { title: 'Attabad Lake & Passu', notes: 'Attabad Lake, Hussaini suspension bridge, Passu Cones, Gulmit and Borith viewpoints.' },
      { title: 'Khunjerab Pass', notes: 'Day trip to Khunjerab Pass at 4,693 m (Pakistan-China border). Permit/weather dependent. Return Karimabad.' },
      { title: 'Return to Islamabad', notes: 'Fly or drive back via Gilgit. Saidpur Village and hotel in Islamabad. Pack buffer for flight delays.' },
      { title: 'Optional Mohenjo-daro', notes: 'Fly to Sukkur/Larkana and visit Mohenjo-daro: Great Bath, citadel and museum. Optional; skip if security/travel conditions are poor.' },
      { title: 'Departure', notes: 'Fly home from ISB (or Karachi if you added Mohenjo-daro). Allow extra time for security checks.' },
    ],
    places: [
      [
        { n: 'Allama Iqbal International Airport (LHE)', c: T, notes: '[transport] Arrival.', lat: 31.5216, lng: 74.4036 },
        { n: 'Hotel — Lahore Walled City', c: H, notes: '[lodging] Haveli-style hotel.', lat: 31.5860, lng: 74.3200 },
        { n: 'Lahore Fort', c: A, notes: '[activity] UNESCO fort, Sheesh Mahal.', lat: 31.5888, lng: 74.3142 },
        { n: 'Badshahi Mosque', c: A, notes: '[activity] 17th-century Mughal mosque.', lat: 31.5883, lng: 74.3109 },
        { n: 'Food Street, Fort Road', c: R, notes: '[food] Dinner with fort views.', lat: 31.5881, lng: 74.3143 },
      ],
      [
        { n: 'Wazir Khan Mosque', c: A, notes: '[activity] Tile-work masterpiece.', lat: 31.5826, lng: 74.3243 },
        { n: 'Shahi Hammam', c: A, notes: '[activity] Restored Mughal bath.', lat: 31.5827, lng: 74.3239 },
        { n: 'Anarkali Bazaar', c: S, notes: '[shopping] Historic market.', lat: 31.5690, lng: 74.3100 },
        { n: 'Shalimar Gardens', c: A, notes: '[activity] UNESCO terraced Mughal gardens.', lat: 31.5856, lng: 74.3811 },
      ],
      [
        { n: 'Lahore Museum', c: A, notes: '[activity] Gandhara sculpture and Fasting Buddha.', lat: 31.5694, lng: 74.3086 },
        { n: 'Tomb of Jahangir', c: A, notes: '[activity] Mughal tomb across the Ravi.', lat: 31.6240, lng: 74.3000 },
        { n: 'Minar-e-Pakistan', c: A, notes: '[activity] National monument.', lat: 31.5925, lng: 74.3095 },
        { n: 'Wagah Border Ceremony', c: X, notes: '[activity] Evening flag-lowering ritual.', lat: 31.6040, lng: 74.5730 },
      ],
      [
        { n: 'Harappa Archaeological Site', c: A, notes: '[activity] Indus Valley Civilization city.', lat: 30.6300, lng: 72.8650 },
        { n: 'Harappa Museum', c: A, notes: '[activity] Seals, pottery and bronzes.', lat: 30.6290, lng: 72.8640 },
        { n: 'Hotel — Sahiwal / Faisalabad', c: H, notes: '[lodging] Overnight.', lat: 30.6600, lng: 73.1000 },
      ],
      [
        { n: 'Khewra Salt Mine', c: A, notes: '[activity] Second-largest salt mine in the world.', lat: 32.6436, lng: 73.0053 },
        { n: 'Katas Raj Temples', c: A, notes: '[activity] Hindu temple complex and sacred pool.', lat: 32.7110, lng: 72.9580 },
        { n: 'Rohtas Fort', c: A, notes: '[activity] UNESCO 16th-century Sher Shah-era fort.', lat: 32.9650, lng: 73.7260 },
        { n: 'Faisal Mosque, Islamabad', c: A, notes: '[activity] Tent-shaped mosque below the Margalla Hills.', lat: 33.7295, lng: 73.0372 },
      ],
      [
        { n: 'Taxila Museum', c: A, notes: '[activity] Gandhara art.', lat: 33.7461, lng: 72.8226 },
        { n: 'Dharmarajika Stupa', c: A, notes: '[activity] Early Buddhist stupa.', lat: 33.7500, lng: 72.8300 },
        { n: 'Sirkap', c: A, notes: '[activity] Hellenistic-grid city ruins.', lat: 33.7600, lng: 72.8320 },
        { n: 'Daman-e-Koh', c: N, notes: '[activity] Margalla Hills viewpoint over Islamabad.', lat: 33.7430, lng: 73.0580 },
      ],
      [
        { n: 'Peshawar Museum', c: A, notes: '[activity] Gandhara collection.', lat: 34.0100, lng: 71.5670 },
        { n: 'Qissa Khwani Bazaar', c: S, notes: '[activity] Storytellers\' Bazaar.', lat: 34.0110, lng: 71.5700 },
        { n: 'Mahabat Khan Mosque', c: A, notes: '[activity] 17th-century Mughal mosque.', lat: 34.0136, lng: 71.5770 },
        { n: 'Bala Hisar Fort', c: A, notes: '[activity] Exterior only; access restricted.', lat: 34.0020, lng: 71.5580 },
        { n: 'Takht-i-Bahi', c: A, notes: '[activity] Optional UNESCO Buddhist monastery.', lat: 34.2932, lng: 71.9438 },
      ],
      [
        { n: 'Gilgit Airport', c: T, notes: '[transport] Fly ISB → GIL or take the KKH.', lat: 35.9188, lng: 74.3336 },
        { n: 'Kargah Buddha', c: A, notes: '[activity] Rock-carved Buddha near Gilgit.', lat: 35.9370, lng: 74.2490 },
        { n: 'Rakaposhi Viewpoint', c: N, notes: '[activity] Roadside view of Rakaposhi (7,788 m).', lat: 36.1500, lng: 74.4680 },
        { n: 'Hotel — Karimabad', c: H, notes: '[lodging] Hunza base for three nights.', lat: 36.3168, lng: 74.6560 },
      ],
      [
        { n: 'Baltit Fort', c: A, notes: '[activity] Restored 700-year-old fort.', lat: 36.3170, lng: 74.6560 },
        { n: 'Altit Fort', c: A, notes: '[activity] Older fort above the Hunza River.', lat: 36.3240, lng: 74.6730 },
        { n: 'Eagle\'s Nest (Duikar)', c: N, notes: '[activity] Sunset over Rakaposhi, Ultar and Hunza.', lat: 36.3328, lng: 74.6522 },
      ],
      [
        { n: 'Attabad Lake', c: N, notes: '[activity] Turquoise lake formed by 2010 landslide.', lat: 36.3070, lng: 74.8950 },
        { n: 'Passu Cones', c: N, notes: '[activity] Iconic spires near Passu.', lat: 36.4630, lng: 74.8860 },
        { n: 'Hussaini Suspension Bridge', c: X, notes: '[activity] Famously rickety footbridge.', lat: 36.4800, lng: 74.8880 },
        { n: 'Borith Lake', c: N, notes: '[activity] Short walk near Gulmit.', lat: 36.4200, lng: 74.8800 },
      ],
      [
        { n: 'Sost Border Post', c: T, notes: '[transport] Immigration/permit checkpoint.', lat: 36.6900, lng: 74.8200 },
        { n: 'Khunjerab Pass', c: N, notes: '[activity] 4,693 m Pakistan-China border pass.', lat: 36.8508, lng: 75.4234 },
        { n: 'Khunjerab National Park', c: N, notes: '[activity] Marco Polo sheep habitat.', lat: 36.7000, lng: 75.0500 },
      ],
      [
        { n: 'Gilgit Airport', c: T, notes: '[transport] Return flight to ISB, or drive the KKH.', lat: 35.9188, lng: 74.3336 },
        { n: 'Saidpur Village', c: S, notes: '[activity] Restored village at Margalla foothills.', lat: 33.7490, lng: 73.0720 },
        { n: 'Hotel — Islamabad', c: H, notes: '[lodging] Overnight.', lat: 33.7200, lng: 73.0600 },
      ],
      [
        { n: 'Mohenjo-daro Airport / Larkana', c: T, notes: '[transport] Optional domestic flight.', lat: 27.3350, lng: 68.1430 },
        { n: 'Mohenjo-daro', c: A, notes: '[activity] UNESCO Indus Valley city; Great Bath and citadel.', lat: 27.3292, lng: 68.1386 },
        { n: 'Mohenjo-daro Museum', c: A, notes: '[activity] Dancing Girl replica and priest-king bust.', lat: 27.3270, lng: 68.1350 },
      ],
      [
        { n: 'Islamabad International Airport (ISB)', c: T, notes: '[transport] Depart.', lat: 33.5560, lng: 72.8340 },
      ],
    ],
  },

  // ───────────────────────── 5. Southern Africa ─────────────────────────
  {
    title: 'Southern Africa: Cape Town to Victoria Falls',
    currency: 'ZAR',
    description:
      '21 days, Version A (Garden Route): ORD → CPT. Cape Town (2–6) → Garden Route: Hermanus, Knysna, Tsitsikamma, Gqeberha (7–9) → Kruger: Skukuza & Lower Sabie (10–13) → Johannesburg: Cradle of Humankind & Soweto (14–16) → Chobe / Kasane (17–18) → Victoria Falls (19) → return (20–21). Note: Drakensberg is an alternative leg that is NOT used in this version. Whales at Hermanus Jul–Nov; Falls strongest Mar–Jun. Malaria prophylaxis for Kruger/Chobe/Vic Falls; check KAZA UniVisa availability.',
    days: [
      { title: 'ORD → CPT', notes: 'Overnight long-haul from Chicago O\'Hare to Cape Town (typically via Johannesburg, Addis Ababa, or Doha). Cross the Atlantic.' },
      { title: 'Arrive Cape Town — V&A Waterfront', notes: 'Land CPT. Hotel near V&A Waterfront. Sunset at Camps Bay and dinner on the Atlantic seaboard.' },
      { title: 'Table Mountain & City Bowl', notes: 'Table Mountain Cableway (clear morning), Bo-Kaap colored houses, Company\'s Garden, Kirstenbosch late afternoon.' },
      { title: 'Cape Peninsula Loop', notes: 'Chapman\'s Peak Drive, Boulders Beach penguins, Simon\'s Town, Cape Point and Cape of Good Hope.' },
      { title: 'Robben Island & District Six', notes: 'Morning Robben Island ferry from the Nelson Mandela Gateway. Afternoon District Six Museum and Bo-Kaap or Woodstock markets.' },
      { title: 'Cape Winelands', notes: 'Groot Constantia, Stellenbosch, Franschhoek wine-tram or tasting, Babylonstoren gardens.' },
      { title: 'Hermanus & Cape Agulhas', notes: 'Walk the Hermanus Cliff Path (whales Jul–Nov). Continue to Cape Agulhas southernmost tip of Africa. Overnight near Swellendam/Mossel Bay.' },
      { title: 'Knysna & Plettenberg Bay', notes: 'Knysna Heads, Waterfront oysters, Robberg Nature Reserve at Plettenberg Bay.' },
      { title: 'Tsitsikamma → Gqeberha', notes: 'Bloukrans Bridge, Storms River Mouth suspension bridges, then Gqeberha (Port Elizabeth) for tomorrow\'s flight.' },
      { title: 'Fly to Kruger — Skukuza', notes: 'Fly Gqeberha → JNB → Skukuza (SZK) or Hoedspruit. Check into Skukuza Rest Camp; evening game drive.' },
      { title: 'Kruger — Skukuza Area', notes: 'Dawn drive on the Sabie River loop, Lake Panic hide, Skukuza Bridge. Afternoon walk or night drive.' },
      { title: 'Kruger — Lower Sabie', notes: 'Drive to Lower Sabie, Sunset Dam, Sabie River watering holes. Overnight at Lower Sabie Rest Camp.' },
      { title: 'Kruger — Final Game Drive', notes: 'H1-2/H4-1 loop back via Tshokwane picnic spot. Return to Skukuza airstrip for afternoon flight to Johannesburg.' },
      { title: 'Johannesburg — Cradle of Humankind', notes: 'Maropeng and Sterkfontein Caves (UNESCO). Evening in Sandton. (Drakensberg is an alt leg, not in this plan.)' },
      { title: 'Soweto Day', notes: 'Vilakazi Street, Hector Pieterson Memorial, Regina Mundi Church, FNB Stadium, Orlando Towers.' },
      { title: 'Jo\'burg Museums & Maboneng', notes: 'Apartheid Museum, Constitution Hill, Maboneng arts precinct and Origins Centre.' },
      { title: 'Fly to Kasane — Chobe', notes: 'Fly JNB → Kasane (BBK). Transfer to Chobe lodge; sunset boat cruise on the Chobe River.' },
      { title: 'Chobe National Park', notes: 'Morning game drive along the river front, afternoon boat safari for elephants, hippos and buffalo.' },
      { title: 'Victoria Falls', notes: 'Transfer to Victoria Falls (Zimbabwe side). Victoria Falls National Park, Victoria Falls Bridge, Zambezi sunset cruise.' },
      { title: 'Falls Morning & Return', notes: 'Sunrise at the Falls. Fly VFA → JNB → ORD.' },
      { title: 'Arrive ORD', notes: 'Land Chicago O\'Hare (same calendar day or next depending on connection).' },
    ],
    places: [
      [{ n: 'ORD → CPT', c: T, notes: '[transport] Long-haul via JNB / ADD / DOH.', lat: 41.9742, lng: -87.9073 }],
      [
        { n: 'Cape Town International Airport (CPT)', c: T, notes: '[transport] Arrival.', lat: -33.9715, lng: 18.6021 },
        { n: 'Hotel — V&A Waterfront', c: H, notes: '[lodging] Base for five nights.', lat: -33.9025, lng: 18.4200 },
        { n: 'Camps Bay Beach', c: B, notes: '[activity] Sunset on the Atlantic seaboard.', lat: -33.9506, lng: 18.3770 },
      ],
      [
        { n: 'Table Mountain Aerial Cableway', c: A, notes: '[activity] Go early; clear weather only.', lat: -33.9484, lng: 18.4037 },
        { n: 'Bo-Kaap', c: A, notes: '[activity] Colorful Cape Malay quarter.', lat: -33.9220, lng: 18.4150 },
        { n: 'Company\'s Garden', c: N, notes: '[activity] Oldest garden in South Africa.', lat: -33.9280, lng: 18.4160 },
        { n: 'Kirstenbosch National Botanical Garden', c: N, notes: '[activity] Boomslang canopy walkway.', lat: -33.9880, lng: 18.4320 },
      ],
      [
        { n: 'Chapman\'s Peak Drive', c: N, notes: '[activity] Coastal toll road.', lat: -34.0800, lng: 18.3550 },
        { n: 'Boulders Beach', c: N, notes: '[activity] African penguin colony.', lat: -34.1975, lng: 18.4510 },
        { n: 'Cape Point', c: N, notes: '[activity] Funicular and lighthouse.', lat: -34.3569, lng: 18.4968 },
        { n: 'Cape of Good Hope', c: N, notes: '[activity] Sign and rocky shore.', lat: -34.3568, lng: 18.4740 },
      ],
      [
        { n: 'Nelson Mandela Gateway to Robben Island', c: T, notes: '[transport] Ferry departure.', lat: -33.9024, lng: 18.4190 },
        { n: 'Robben Island', c: A, notes: '[activity] UNESCO prison island tour.', lat: -33.8070, lng: 18.3660 },
        { n: 'District Six Museum', c: A, notes: '[activity] Forced removals history.', lat: -33.9290, lng: 18.4230 },
      ],
      [
        { n: 'Groot Constantia', c: C, notes: '[activity] Oldest wine estate in South Africa.', lat: -34.0270, lng: 18.4220 },
        { n: 'Stellenbosch', c: A, notes: '[activity] Historic university town.', lat: -33.9346, lng: 18.8602 },
        { n: 'Franschhoek', c: C, notes: '[activity] Wine tram and tastings.', lat: -33.9120, lng: 19.1190 },
        { n: 'Babylonstoren', c: N, notes: '[activity] Farm gardens and restaurant.', lat: -33.8190, lng: 18.9390 },
      ],
      [
        { n: 'Hermanus Cliff Path', c: N, notes: '[activity] Land-based whale watching Jul–Nov.', lat: -34.4160, lng: 19.2450 },
        { n: 'Hermanus Old Harbour', c: A, notes: '[activity] Heritage museum.', lat: -34.4200, lng: 19.2340 },
        { n: 'Cape Agulhas', c: N, notes: '[activity] Southernmost tip of Africa.', lat: -34.8344, lng: 20.0152 },
        { n: 'Hotel — Swellendam / Mossel Bay', c: H, notes: '[lodging] Overnight.', lat: -34.0200, lng: 20.4400 },
      ],
      [
        { n: 'Knysna Heads', c: N, notes: '[activity] Viewpoint over the lagoon mouth.', lat: -34.0820, lng: 23.0560 },
        { n: 'Knysna Waterfront', c: R, notes: '[food] Fresh oysters.', lat: -34.0350, lng: 23.0480 },
        { n: 'Robberg Nature Reserve', c: N, notes: '[activity] Peninsula hike with seals.', lat: -34.1100, lng: 23.3920 },
      ],
      [
        { n: 'Bloukrans Bridge', c: X, notes: '[activity] Bungee viewpoint.', lat: -33.9660, lng: 23.6560 },
        { n: 'Storms River Mouth', c: N, notes: '[activity] Suspension bridge walk.', lat: -34.0240, lng: 23.8970 },
        { n: 'Gqeberha (Port Elizabeth)', c: H, notes: '[lodging] Overnight near PLZ airport.', lat: -33.9608, lng: 25.6022 },
      ],
      [
        { n: 'Port Elizabeth Airport (PLZ)', c: T, notes: '[transport] Fly PLZ → JNB → SZK.', lat: -33.9849, lng: 25.6173 },
        { n: 'Skukuza Airport (SZK)', c: T, notes: '[transport] Airstrip arrival.', lat: -24.9609, lng: 31.5887 },
        { n: 'Skukuza Rest Camp', c: H, notes: '[lodging] Main Kruger camp.', lat: -24.9948, lng: 31.5929 },
        { n: 'Skukuza sunset drive', c: N, notes: '[activity] First Kruger game drive.', lat: -24.9930, lng: 31.5890 },
      ],
      [
        { n: 'Sabie River Loop', c: N, notes: '[activity] Early morning drive.', lat: -24.9930, lng: 31.5890 },
        { n: 'Lake Panic Bird Hide', c: N, notes: '[activity] Hippo and bird hide.', lat: -24.9980, lng: 31.5760 },
        { n: 'Skukuza Night Drive', c: N, notes: '[activity] Guided night drive.', lat: -24.9948, lng: 31.5929 },
      ],
      [
        { n: 'Lower Sabie Rest Camp', c: H, notes: '[lodging] Riverside camp.', lat: -25.1190, lng: 31.9190 },
        { n: 'Sunset Dam', c: N, notes: '[activity] Hippo and crocodile hotspot.', lat: -25.1170, lng: 31.9170 },
        { n: 'Lower Sabie Restaurant', c: R, notes: '[food] Deck dining over the Sabie River.', lat: -25.1190, lng: 31.9190 },
      ],
      [
        { n: 'Tshokwane Picnic Site', c: R, notes: '[food] Mid-route breakfast stop.', lat: -24.8390, lng: 31.8310 },
        { n: 'H1-2 Game Drive', c: N, notes: '[activity] Final loop back to Skukuza.', lat: -24.9500, lng: 31.6500 },
        { n: 'Skukuza Airstrip', c: T, notes: '[transport] Flight to JNB.', lat: -24.9609, lng: 31.5887 },
      ],
      [
        { n: 'O.R. Tambo International Airport (JNB)', c: T, notes: '[transport] Arrival from Skukuza.', lat: -26.1392, lng: 28.2460 },
        { n: 'Maropeng Visitor Centre', c: A, notes: '[activity] Cradle of Humankind exhibition.', lat: -26.0180, lng: 27.7370 },
        { n: 'Sterkfontein Caves', c: A, notes: '[activity] Hominin fossil site, UNESCO.', lat: -26.0176, lng: 27.7350 },
        { n: 'Hotel — Sandton', c: H, notes: '[lodging] Johannesburg base.', lat: -26.1076, lng: 28.0567 },
      ],
      [
        { n: 'Vilakazi Street', c: A, notes: '[activity] Mandela and Tutu houses.', lat: -26.2380, lng: 27.9060 },
        { n: 'Hector Pieterson Memorial', c: A, notes: '[activity] 1976 uprising memorial.', lat: -26.2310, lng: 27.9060 },
        { n: 'Regina Mundi Church', c: A, notes: '[activity] Anti-apartheid landmark.', lat: -26.2540, lng: 27.8920 },
        { n: 'FNB Stadium', c: A, notes: '[activity] "Calabash" stadium.', lat: -26.2340, lng: 27.9820 },
        { n: 'Orlando Towers', c: X, notes: '[activity] Graffiti cooling towers; bungee/swing optional.', lat: -26.2500, lng: 27.9340 },
      ],
      [
        { n: 'Apartheid Museum', c: A, notes: '[activity] Essential history museum.', lat: -26.2380, lng: 28.0080 },
        { n: 'Constitution Hill', c: A, notes: '[activity] Former prison and Constitutional Court.', lat: -26.1900, lng: 28.0420 },
        { n: 'Maboneng Precinct', c: S, notes: '[activity] Street art, galleries and markets.', lat: -26.2040, lng: 28.0600 },
        { n: 'Origins Centre', c: A, notes: '[activity] San rock art and human origins.', lat: -26.1920, lng: 28.0300 },
      ],
      [
        { n: 'Kasane Airport (BBK)', c: T, notes: '[transport] Fly JNB → BBK.', lat: -17.8330, lng: 25.1620 },
        { n: 'Chobe Safari Lodge', c: H, notes: '[lodging] Riverside lodge.', lat: -17.8010, lng: 25.1830 },
        { n: 'Chobe River Sunset Cruise', c: X, notes: '[activity] Elephants and hippos at dusk.', lat: -17.8080, lng: 25.1550 },
      ],
      [
        { n: 'Chobe National Park Riverfront', c: N, notes: '[activity] Morning game drive.', lat: -17.8380, lng: 25.0800 },
        { n: 'Sedudu Island', c: N, notes: '[activity] Boat-safari elephant crossing point.', lat: -17.8000, lng: 25.2000 },
        { n: 'Kasane Town', c: S, notes: '[shopping] Local crafts.', lat: -17.8100, lng: 25.1500 },
      ],
      [
        { n: 'Kazungula Border Crossing', c: T, notes: '[transport] Botswana → Zimbabwe (UniVisa if available).', lat: -17.7870, lng: 25.2700 },
        { n: 'Victoria Falls National Park', c: A, notes: '[activity] UNESCO Mosi-oa-Tunya viewpoints.', lat: -17.9243, lng: 25.8572 },
        { n: 'Victoria Falls Bridge', c: X, notes: '[activity] Colonial bridge over the Zambezi.', lat: -17.9291, lng: 25.8590 },
        { n: 'Zambezi Sunset Cruise', c: X, notes: '[activity] Upstream cruise.', lat: -17.9270, lng: 25.8460 },
      ],
      [
        { n: 'Victoria Falls sunrise viewpoint', c: N, notes: '[activity] Early-morning mist and rainbows.', lat: -17.9243, lng: 25.8572 },
        { n: 'Victoria Falls Airport (VFA)', c: T, notes: '[transport] Fly VFA → JNB.', lat: -18.0959, lng: 25.8390 },
        { n: 'JNB → ORD', c: T, notes: '[transport] Long-haul return.', lat: -26.1392, lng: 28.2460 },
      ],
      [{ n: 'Chicago O\'Hare (ORD)', c: T, notes: '[transport] Arrival home.', lat: 41.9742, lng: -87.9073 }],
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

  // Rename long titles → short names before lookup so re-seeds stay idempotent.
  const renameTrip = db.prepare('UPDATE trips SET title = ? WHERE id = ?')
  for (const [oldTitle, newTitle] of Object.entries(RENAME)) {
    const id = existing.get(oldTitle)
    if (!id || existing.has(newTitle)) continue
    renameTrip.run(newTitle, id)
    existing.delete(oldTitle)
    existing.set(newTitle, id)
    console.log(`RENAMED #${id} "${oldTitle}" → "${newTitle}"`)
  }

  const insertTrip = db.prepare(`
    INSERT INTO trips (user_id, title, description, start_date, end_date, currency, reminder_days, cover_image, sort_order)
    VALUES (?, ?, ?, NULL, NULL, ?, 3, ?, ?)
  `)
  const insertDay = db.prepare(`
    INSERT INTO days (trip_id, day_number, date, title, notes) VALUES (?, ?, NULL, ?, ?)
  `)
  const bumpSortOrder = db.prepare(
    'UPDATE trips SET sort_order = COALESCE(sort_order, 999) + 5 WHERE user_id = ?',
  )
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

  // Validate day/place alignment up front (before touching sort_order).
  for (const trip of TRIPS) {
    if (trip.days.length !== trip.places.length) {
      console.error(`MISMATCH ${trip.title}: days=${trip.days.length} placesDays=${trip.places.length}`)
      process.exit(1)
    }
  }

  // Push existing trips down by 5 so new ones can occupy sort_order 0..4 at the top.
  // Only run when at least one trip is actually new, so re-runs stay idempotent.
  if (TRIPS.some((t) => !existing.has(t.title))) {
    const bumped = bumpSortOrder.run(USER_ID)
    console.log(`Bumped sort_order +5 on ${bumped.changes} existing trips`)
  }

  const seedOne = db.transaction((trip, sortOrder) => {
    const covers = COVERS[trip.title] || []
    let tripId = existing.get(trip.title)
    if (!tripId) {
      const r = insertTrip.run(USER_ID, trip.title, trip.description, trip.currency, covers[0] || null, sortOrder)
      tripId = Number(r.lastInsertRowid)
      trip.days.forEach((d, i) => insertDay.run(tripId, i + 1, d.title, d.notes))
      existing.set(trip.title, tripId)
      console.log(`CREATED #${tripId} ${trip.title} (${trip.days.length} days, sort_order=${sortOrder})`)
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
  TRIPS.forEach((trip, idx) => {
    const out = seedOne(trip, idx)
    console.log(`  → ${out.places} places`)
    totalPlaces += out.places
  })

  console.log(`\nDone. ${totalPlaces} places across ${TRIPS.length} trips.`)
  db.close()
}

main()
