#!/usr/bin/env node
/**
 * Seed "South India: Tamil Nadu & Karnataka" (dateless planned trip: 21 days + places + covers).
 * On first create the trip is placed at the top of the planned list (sort_order 0, existing trips
 * bumped +1). Re-runs only refresh places + cover (sort_order is NOT bumped again).
 * Usage: node scripts/seed-ty-south-india.mjs
 */
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../server/data/travel.db')
const USER_ID = 2

const H = 1, R = 2, A = 3, S = 4, T = 5, X = 6, C = 7, B = 8, N = 9, O = 10
void B; void C; void O

const COVERS = {
  'South India: Tamil Nadu & Karnataka': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Brihadisvara_Temple_during_Maha_Shivaratri-WUS03611_%28edit%29.jpg/1920px-Brihadisvara_Temple_during_Maha_Shivaratri-WUS03611_%28edit%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Complex_of_Virupaksha_Temple%2C_Hampi_%2801%29.jpg/1920px-Complex_of_Virupaksha_Temple%2C_Hampi_%2801%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Gopuram_of_the_Meenakshi_Temple_at_Madurai.jpg/1920px-Gopuram_of_the_Meenakshi_Temple_at_Madurai.jpg',
  ],
}

/** @type {{ title: string, currency: string, description: string, days: { title: string, notes: string }[], places: { n: string, c?: number, notes?: string, lat?: number, lng?: number }[][] }[]} */
const TRIPS = [
  {
    title: 'South India: Tamil Nadu & Karnataka',
    currency: 'INR',
    description:
      '21 days / 20 nights open-jaw ORD→MAA, BLR→ORD. Late Jan–Feb best. Route: Chennai → Kanchipuram → Mahabalipuram → Puducherry → Gingee → Chola temples → Chettinad → Madurai → Mysuru → Hoysalas → Hampi → Aihole/Pattadakal/Badami → BLR. Private drivers for archaeology circuits; domestic flights IXM→BLR and HBX→BLR. Temple midday closures; Chennai Govt Museum closed Fridays; Saraswathi Mahal closed Wednesdays. Target ~$3,400–4,200 in-country+hotels excl intl airfare variance. UNESCO: Mahabalipuram, Great Living Chola Temples, Hoysala ensembles, Hampi, Pattadakal, Gingee (Maratha Military Landscapes).',
    days: [
      { title: 'Arrive Chennai — Mylapore & Marina', notes: 'Land MAA (ORD→MAA open-jaw; long-haul usually arrives the next calendar day). Prepaid taxi/Uber to a Mylapore/Alwarpet hotel (nights 1–2). Late afternoon: Kapaleeshwarar Temple (Dravidian gopuram, active temple — remove shoes, modest dress; typically closed ~12:00–16:00). Sunset walk on Marina Beach; filter coffee and tiffin in Mylapore.' },
      { title: 'Fort St George, Govt Museum & George Town', notes: 'Fort St George and its museum (Mon–Sat, early). Government Museum Egmore: bronzes gallery (CLOSED FRIDAYS — swap with George Town if Friday). Afternoon George Town: Armenian Church, Parry\'s Corner, Kapaleeshwarar/Sowcarpet street food. Second night in Chennai.' },
      { title: 'Kanchipuram temples → Mahabalipuram', notes: 'Private driver ~2 h to Kanchipuram. Kailasanathar (Pallava, c. 700 CE, sandstone), Ekambareswarar (3,500-year-old mango tree, 1,000-pillar hall), Varadaraja Perumal (carved stone chain). Temples close ~12:30–16:00, so start early. Silk-sari weavers co-op visit. Continue ~1.5 h to Mahabalipuram for the night (Night 3).' },
      { title: 'Mahabalipuram UNESCO → Puducherry', notes: 'Sunrise at the Shore Temple, then Pancha (Five) Rathas, Arjuna\'s Penance bas-relief, Krishna Mandapam and Varaha/Mahishasuramardini caves. ASI ticket for Shore Temple + Rathas (foreigner rate ~₹600; verify). ~2 h drive down ECR to Puducherry White Town. Evening promenade and French-quarter dinner (nights 4–5).' },
      { title: 'Gingee Fort day trip from Puducherry', notes: 'Drive ~1.5 h to Gingee (Senji), UNESCO "Maratha Military Landscapes". Climb Rajagiri (steep, ~1,000 steps; start by 8:00, carry water/hat). Kalyana Mahal, granary, Venkataramana Temple. Return for Sri Aurobindo Ashram samadhi, Auroville/Matrimandir viewing point, and Puducherry crêperies.' },
      { title: 'Chidambaram → Gangaikondacholapuram → Darasuram → Thanjavur', notes: 'Long driving day (~6–7 h w/ stops), private driver. Nataraja Temple in Chidambaram (closed ~12:30–16:00). Gangaikondacholapuram Brihadisvara and Airavatesvara at Darasuram are two of the three Great Living Chola Temples (UNESCO). Arrive Thanjavur for nights 6–7.' },
      { title: 'Thanjavur: Brihadisvara, Palace & Saraswathi Mahal', notes: 'Brihadisvara Temple (UNESCO, ~1010 CE, 66 m vimana) at opening, ~6:00–12:30 and 16:00–20:30. Thanjavur Maratha Palace + Durbar Hall, Royal Palace Art Gallery (Chola bronzes). Saraswathi Mahal Library (CLOSED WEDNESDAYS). Try Thanjavur painting and bronze shops; thali for lunch, kothu parotta for dinner.' },
      { title: 'Srirangam → Chettinad mansions', notes: 'Drive ~3.5 h with a stop at Srirangam\'s Ranganathaswamy Temple (largest functioning Hindu temple complex, 21 gopurams; closed midday). Continue to Chettinad (Karaikudi/Kanadukathan): mansion walk, Athangudi tile workshop, antique shops. Stay and dinner at The Bangala (Chettinad cuisine; night 8).' },
      { title: 'Chettinad → Madurai Meenakshi', notes: 'Morning mansion visit (Chettinad Palace, Kanadukathan), Pillaiyarpatti rock-cut Ganesha. ~2 h to Madurai. Evening at Meenakshi Amman Temple (Palliyarai night ceremony ~21:00). Finish with Jigarthanda (Madurai\'s iced milk-almond gum dessert). Hotel nights 9–10.' },
      { title: 'Madurai: Meenakshi, Palace, Gandhi Museum & food walk', notes: 'Meenakshi Amman Temple early (opens ~5:00; closed ~12:30–16:00). Thirumalai Nayakkar Mahal, Gandhi Memorial Museum (Mahatma\'s blood-stained cloth; check current hours). Vandiyur Teppakulam. Evening street-food walk: idli at Murugan Idli Shop, parotta/salna, Jigarthanda.' },
      { title: 'Madurai → Bengaluru flight → Mysuru', notes: 'Fly IXM→BLR (~1 h 15). Private driver BLR→Mysuru ~3.5 h. Mysuru Palace (10:00–17:30; illuminated Sundays/festivals), Devaraja Market (flowers, kumkum, incense), Mysore pak at Guru Sweet Mart. Hotel nights 11–12.' },
      { title: 'Somanathapura & Srirangapatna', notes: 'Chennakesava Temple at Somanathapura (Hoysala, 1258 CE; UNESCO ensemble) ~1 h from Mysuru. Srirangapatna: Ranganathaswamy Temple, Daria Daulat Bagh (Tipu\'s Summer Palace), Gumbaz (Tipu\'s mausoleum), Tipu\'s dungeons. Evening Mysuru stroll.' },
      { title: 'Shravanabelagola → Hassan', notes: 'Drive ~2 h to Shravanabelagola: Gommateshwara/Bahubali monolith (18 m, 983 CE) after 600+ steps up Vindhyagiri (shoes off; open ~6:00–18:00). Chandragiri hill Jain basadis. Continue to Hassan (nights 13–14).' },
      { title: 'Belur & Halebidu (Hoysala UNESCO)', notes: 'Belur Chennakeshava Temple (active; star-shaped plan, madanika bracket figures) and Halebidu Hoysaleswara + Kedareshwara temples (ASI; foreigner ticket ~₹600; verify). Temple interiors dark — bring a torch. Return Hassan.' },
      { title: 'Chitradurga Fort → Hampi', notes: 'Early start, ~7 h in car. Chitradurga: seven-layer stone fort, Onake Obavva Kindi, Hidimbeshwara Temple. Evening arrival in Hampi/Kamalapura (nights 15–17). Sunset at Matanga Hill if energy permits.' },
      { title: 'Hampi sacred center', notes: 'Early morning Hemakuta Hill group of temples, Virupaksha Temple (active; elephant Lakshmi blessings), Hampi Bazaar and Courtesan\'s Street. Sasivekalu and Kadalekalu Ganesha, Krishna Temple, Lakshmi Narasimha (monolith), Achyutaraya Temple at sunset. Heat midday — rest 12:00–15:00.' },
      { title: 'Hampi royal center: Vittala, Royal Enclosure', notes: 'Vittala Temple at opening (stone chariot, musical pillars; ASI ~₹600 foreigner; verify). Walk the river path to Royal Enclosure (Mahanavami Dibba, stepped tank), then Zenana Enclosure: Lotus Mahal, Elephant Stables. Coracle ride optional on the Tungabhadra.' },
      { title: 'Aihole → Pattadakal UNESCO → Badami', notes: 'Private driver ~4 h from Hampi to Aihole (Durga Temple, Lad Khan, Meguti Jain temple, Ravana Phadi cave). Pattadakal (UNESCO; Virupaksha and Sangameshwara temples; ASI ticket). Arrive Badami (nights 18–19).' },
      { title: 'Badami caves, Agastya Lake & Fort', notes: 'Badami Cave Temples (4 caves, 6th c. Chalukya; ASI ticket; closes ~18:00). Agastya Lake steps, Bhutanatha temples at sunset, Archaeological Museum, Upper/Lower Shivalaya forts. Optional Mahakuta temples (~15 km).' },
      { title: 'Badami → Hubballi → Bengaluru', notes: 'Driver ~2.5–3 h to Hubballi (HBX); fly HBX→BLR (~1 h 10). Final-night hotel: Bengaluru city (Vidhana Soudha/Cubbon Park, VV Puram food street) or near BLR airport for early flight (night 20).' },
      { title: 'Bengaluru → Chicago O\'Hare', notes: 'Check out, transfer to BLR (Terminal 2). Open-jaw departure BLR→ORD (typically via a Gulf/Europe hub). Arrive 3 h+ before international departure.' },
    ],
    places: [
      // Day 1
      [
        { n: 'Chennai International Airport (MAA)', c: T, notes: '[transport] Arrival from ORD (open-jaw). Prepaid taxi to Mylapore ~45 min. Buy Indian SIM / withdraw INR.', lat: 12.9941, lng: 80.1709 },
        { n: 'Chennai hotel — Mylapore / Alwarpet (nights 1–2)', c: H, notes: '[lodging] Base for Chennai; walking distance to Kapaleeshwarar and filter-coffee stalls.', lat: 13.0339, lng: 80.2540 },
        { n: 'Kapaleeshwarar Temple', c: A, notes: '[activity] Pallava-era Shiva temple with towering gopuram; shoes off, modest dress. Closed ~12:00–16:00.', lat: 13.0337, lng: 80.2697 },
        { n: 'Marina Beach', c: N, notes: '[activity] Sunset promenade; try sundal and fresh fish fry from stalls.', lat: 13.0500, lng: 80.2824 },
        { n: 'Mylapore tiffin & filter coffee', c: R, notes: '[food] Idli, ghee pongal, vada and filter coffee near the temple tank.', lat: 13.0345, lng: 80.2690 },
      ],
      // Day 2
      [
        { n: 'Fort St George & Museum', c: A, notes: '[activity] First British fort in India (1644); museum in the Exchange Building. Allow 1.5 h.', lat: 13.0797, lng: 80.2879 },
        { n: 'Government Museum Egmore (Bronze Gallery)', c: A, notes: '[activity] Chola bronzes. CLOSED FRIDAYS. Open ~9:30–17:00.', lat: 13.0705, lng: 80.2565 },
        { n: 'Armenian Church, George Town', c: A, notes: '[activity] 1772 church in the old trading quarter.', lat: 13.0924, lng: 80.2879 },
        { n: 'George Town & Parry\'s Corner', c: S, notes: '[shopping] Spice, textile and stationery lanes; Sowcarpet snacks.', lat: 13.0900, lng: 80.2870 },
        { n: 'Chennai dinner — South Indian meals', c: R, notes: '[food] Banana-leaf meals, kothu parotta; try Murugan Idli Shop or Ratna Cafe.', lat: 13.0560, lng: 80.2575 },
      ],
      // Day 3
      [
        { n: 'Kailasanathar Temple, Kanchipuram', c: A, notes: '[activity] Pallava sandstone masterpiece (c. 700 CE). Closed ~12:30–16:00.', lat: 12.8250, lng: 79.6933 },
        { n: 'Ekambareswarar Temple', c: A, notes: '[activity] Giant gopuram, 1,000-pillar hall, 3,500-year-old mango tree.', lat: 12.8473, lng: 79.6987 },
        { n: 'Varadaraja Perumal Temple', c: A, notes: '[activity] Vijayanagara-era Vishnu temple; carved stone chain.', lat: 12.8185, lng: 79.7261 },
        { n: 'Kanchipuram silk weavers co-op', c: S, notes: '[shopping] Handloom silk saris; buy from weavers or the government co-op (check Silk Mark).', lat: 12.8342, lng: 79.7036 },
        { n: 'Mahabalipuram hotel (night 3)', c: H, notes: '[lodging] Near the Shore Temple; beach resorts or small guesthouses on East Coast Road.', lat: 12.6169, lng: 80.1928 },
        { n: 'Moonrakers seafood, Mahabalipuram', c: R, notes: '[food] Grilled fish, prawn masala; sunset dinner.', lat: 12.6173, lng: 80.1944 },
      ],
      // Day 4
      [
        { n: 'Shore Temple, Mahabalipuram', c: A, notes: '[activity] UNESCO granite temple on the Bay of Bengal (8th c.). Go at opening; ASI combined ticket.', lat: 12.6164, lng: 80.1993 },
        { n: 'Pancha Rathas (Five Rathas)', c: A, notes: '[activity] Monolithic rock-cut chariot-temples.', lat: 12.6094, lng: 80.2020 },
        { n: 'Arjuna\'s Penance', c: A, notes: '[activity] Giant open-air bas-relief; Krishna Mandapam and caves nearby.', lat: 12.6169, lng: 80.1920 },
        { n: 'Private driver — Mahabalipuram → Puducherry', c: T, notes: '[transport] ~2 h via East Coast Road (ECR); Muttukadu boat house stop optional.', lat: 12.2000, lng: 80.0500 },
        { n: 'Puducherry hotel — White Town (nights 4–5)', c: H, notes: '[lodging] Heritage guesthouse in the French Quarter.', lat: 11.9335, lng: 79.8330 },
        { n: 'Promenade Beach, Puducherry', c: N, notes: '[activity] Evening walk by Gandhi statue and Old Lighthouse.', lat: 11.9348, lng: 79.8347 },
      ],
      // Day 5
      [
        { n: 'Gingee Fort (Rajagiri)', c: A, notes: '[activity] UNESCO Maratha Military Landscapes; steep ~1,000-step climb; open 9:00–17:00.', lat: 12.2526, lng: 79.4189 },
        { n: 'Kalyana Mahal & Venkataramana Temple, Gingee', c: A, notes: '[activity] Seven-storey palace tower, granary and tank at the base.', lat: 12.2540, lng: 79.4200 },
        { n: 'Sri Aurobindo Ashram, Puducherry', c: A, notes: '[activity] Samadhi courtyard; quiet dress code.', lat: 11.9336, lng: 79.8340 },
        { n: 'Matrimandir viewpoint, Auroville', c: A, notes: '[activity] Viewing-point entry is free; inner chamber needs advance booking.', lat: 12.0069, lng: 79.8106 },
        { n: 'French Quarter dinner — crêperie / bistro', c: R, notes: '[food] Seafood, crêpes, Le Café on the promenade.', lat: 11.9347, lng: 79.8336 },
      ],
      // Day 6
      [
        { n: 'Nataraja Temple, Chidambaram', c: A, notes: '[activity] Shiva as Cosmic Dancer; dikshitar priests; closed ~12:30–16:00.', lat: 11.3993, lng: 79.6937 },
        { n: 'Gangaikondacholapuram Brihadisvara Temple', c: A, notes: '[activity] UNESCO Great Living Chola Temple; built by Rajendra Chola I.', lat: 11.2060, lng: 79.4498 },
        { n: 'Airavatesvara Temple, Darasuram', c: A, notes: '[activity] UNESCO Great Living Chola Temple; chariot-wheel plinth, exquisite sculpture.', lat: 10.9490, lng: 79.3567 },
        { n: 'Thanjavur hotel (nights 6–7)', c: H, notes: '[lodging] Near the Brihadisvara Temple for early entry.', lat: 10.7870, lng: 79.1378 },
        { n: 'Thanjavur dinner — kothu parotta', c: R, notes: '[food] Casual local dinner near the old bus stand.', lat: 10.7878, lng: 79.1385 },
      ],
      // Day 7
      [
        { n: 'Brihadisvara Temple, Thanjavur', c: A, notes: '[activity] UNESCO Great Living Chola Temple (1010 CE); 66 m vimana, giant Nandi. Open ~6:00–12:30, 16:00–20:30.', lat: 10.7828, lng: 79.1318 },
        { n: 'Thanjavur Maratha Palace & Durbar Hall', c: A, notes: '[activity] Nayak/Maratha palace complex; Royal Palace Art Gallery (Chola bronzes).', lat: 10.7853, lng: 79.1437 },
        { n: 'Saraswathi Mahal Library', c: A, notes: '[activity] Manuscript library & museum inside the palace. CLOSED WEDNESDAYS.', lat: 10.7851, lng: 79.1430 },
        { n: 'Thanjavur painting & bronze shopping', c: S, notes: '[shopping] Gold-leaf Thanjavur paintings; buy certified pieces (Poompuhar government emporium).', lat: 10.7864, lng: 79.1405 },
        { n: 'Thali lunch — Thanjavur', c: R, notes: '[food] Banana-leaf meals; ask for Thanjavur-style sambar and appalam.', lat: 10.7880, lng: 79.1395 },
      ],
      // Day 8
      [
        { n: 'Ranganathaswamy Temple, Srirangam', c: A, notes: '[activity] Largest functioning Hindu temple complex; 21 gopurams, ~7 courtyards. Closed ~13:00–15:00.', lat: 10.8626, lng: 78.6889 },
        { n: 'Chettinad mansion walk, Kanadukathan', c: A, notes: '[activity] Burma-teak, Italian-tile and Belgian-glass mansions of Nattukottai Chettiars.', lat: 10.0980, lng: 78.7790 },
        { n: 'Athangudi tile workshop', c: S, notes: '[shopping] Handmade glass-like cement tiles; watch the process.', lat: 10.0560, lng: 78.8000 },
        { n: 'The Bangala, Karaikudi (night 8)', c: H, notes: '[lodging] Heritage Chettinad guest house; book ahead.', lat: 10.0736, lng: 78.7773 },
        { n: 'Chettinad dinner at The Bangala', c: R, notes: '[food] Pepper chicken, kola urundai, kuzhi paniyaram, seeyam.', lat: 10.0736, lng: 78.7773 },
      ],
      // Day 9
      [
        { n: 'Chettinad Palace, Kanadukathan', c: A, notes: '[activity] Largest Chettinad mansion; Athangudi tiles and teak pillars.', lat: 10.1000, lng: 78.7667 },
        { n: 'Pillaiyarpatti Karpaga Vinayagar Temple', c: A, notes: '[activity] 7th-c. rock-cut Ganesha.', lat: 10.1996, lng: 78.7890 },
        { n: 'Madurai hotel (nights 9–10)', c: H, notes: '[lodging] Near Meenakshi east gopuram.', lat: 9.9250, lng: 78.1190 },
        { n: 'Meenakshi Amman Temple', c: A, notes: '[activity] 14 gopurams, Hall of 1,000 Pillars; evening Palliyarai ceremony ~21:00.', lat: 9.9195, lng: 78.1193 },
        { n: 'Famous Jigarthanda', c: R, notes: '[food] Iced milk, almond gum, ice cream — Madurai\'s signature drink.', lat: 9.9205, lng: 78.1200 },
      ],
      // Day 10
      [
        { n: 'Meenakshi Amman Temple (morning)', c: A, notes: '[activity] Go at ~6:00 before crowds; closed midday.', lat: 9.9195, lng: 78.1193 },
        { n: 'Thirumalai Nayakkar Mahal', c: A, notes: '[activity] 17th-c. Indo-Saracenic palace; sound & light show evening.', lat: 9.9150, lng: 78.1235 },
        { n: 'Gandhi Memorial Museum', c: A, notes: '[activity] Freedom-struggle exhibits; Gandhi\'s blood-stained cloth.', lat: 9.9370, lng: 78.1480 },
        { n: 'Vandiyur Mariamman Teppakulam', c: N, notes: '[activity] Vast temple tank; float festival in Jan–Feb.', lat: 9.9100, lng: 78.1420 },
        { n: 'Madurai street-food walk', c: R, notes: '[food] Murugan Idli Shop, Amma Mess for parotta & mutton chukka, Jigarthanda stalls.', lat: 9.9190, lng: 78.1140 },
        { n: 'Pudhu Mandapam tailor market', c: S, notes: '[shopping] Bargain for custom-stitched clothes, brass lamps.', lat: 9.9188, lng: 78.1210 },
      ],
      // Day 11
      [
        { n: 'Madurai Airport (IXM)', c: T, notes: '[transport] Fly IXM→BLR (~1 h 15); arrive 2 h before.', lat: 9.8345, lng: 78.0934 },
        { n: 'Kempegowda International Airport (BLR)', c: T, notes: '[transport] Meet private driver for Mysuru (~3.5 h).', lat: 13.1986, lng: 77.7066 },
        { n: 'Mysuru hotel (nights 11–12)', c: H, notes: '[lodging] Near Mysuru Palace for easy evening walks.', lat: 12.3070, lng: 76.6540 },
        { n: 'Mysuru Palace', c: A, notes: '[activity] Indo-Saracenic royal palace; open ~10:00–17:30; illuminated Sundays.', lat: 12.3052, lng: 76.6552 },
        { n: 'Devaraja Market', c: S, notes: '[shopping] Flowers, kumkum, incense, sandalwood.', lat: 12.3103, lng: 76.6520 },
        { n: 'Guru Sweet Mart (Mysore pak)', c: R, notes: '[food] Original ghee-rich Mysore pak; buy boxes.', lat: 12.3085, lng: 76.6460 },
      ],
      // Day 12
      [
        { n: 'Chennakesava Temple, Somanathapura', c: A, notes: '[activity] Hoysala masterpiece (1258 CE); ASI ticket.', lat: 12.2740, lng: 76.8650 },
        { n: 'Ranganathaswamy Temple, Srirangapatna', c: A, notes: '[activity] Active Vishnu temple on a Kaveri island.', lat: 12.4180, lng: 76.6930 },
        { n: 'Daria Daulat Bagh (Tipu Sultan\'s Summer Palace)', c: A, notes: '[activity] Painted wall murals; ASI ticket.', lat: 12.4219, lng: 76.7105 },
        { n: 'Gumbaz — Tipu Sultan\'s Mausoleum', c: A, notes: '[activity] Domed tomb of Tipu, Hyder Ali.', lat: 12.4260, lng: 76.7260 },
        { n: 'Mysuru dinner — dosas & meals', c: R, notes: '[food] Mylari Dosa for butter dosa; evening in Mysuru.', lat: 12.3095, lng: 76.6480 },
      ],
      // Day 13
      [
        { n: 'Gommateshwara (Bahubali), Shravanabelagola', c: A, notes: '[activity] 18 m Jain monolith (983 CE); 600+ steps up Vindhyagiri; shoes off.', lat: 12.8540, lng: 76.4837 },
        { n: 'Chandragiri Hill basadis', c: A, notes: '[activity] Smaller hill with early Jain temples.', lat: 12.8560, lng: 76.4860 },
        { n: 'Hassan hotel (nights 13–14)', c: H, notes: '[lodging] Base for Belur & Halebidu.', lat: 13.0072, lng: 76.1004 },
        { n: 'Hassan dinner at hotel restaurant', c: R, notes: '[food] Karnataka meals / ragi mudde; place orders early.', lat: 13.0070, lng: 76.1005 },
      ],
      // Day 14
      [
        { n: 'Chennakeshava Temple, Belur', c: A, notes: '[activity] Hoysala star-shaped temple; madanika bracket figures. Open ~7:30–20:30 (active).', lat: 13.1650, lng: 75.8650 },
        { n: 'Hoysaleswara Temple, Halebidu', c: A, notes: '[activity] Twin-shrine Hoysala temple, UNESCO ensemble; ASI.', lat: 13.2120, lng: 75.9940 },
        { n: 'Kedareshwara Temple, Halebidu', c: A, notes: '[activity] Quiet small Hoysala temple, fine sculpture.', lat: 13.2100, lng: 75.9960 },
        { n: 'Belur/Halebidu village lunch', c: R, notes: '[food] Local meals; carry water.', lat: 13.1700, lng: 75.8600 },
      ],
      // Day 15
      [
        { n: 'Chitradurga Fort', c: A, notes: '[activity] Seven-layer stone fort; Onake Obavva Kindi, Hidimbeshwara Temple.', lat: 14.2250, lng: 76.4000 },
        { n: 'Private driver — Hassan → Chitradurga → Hampi', c: T, notes: '[transport] ~7 h incl. stops; leave by 7:00.', lat: 14.0000, lng: 76.2000 },
        { n: 'Hampi hotel (nights 15–17)', c: H, notes: '[lodging] Guesthouses at Hampi Bazaar or Kamalapura.', lat: 15.3360, lng: 76.4610 },
        { n: 'Matanga Hill sunset', c: N, notes: '[activity] Best panoramic view over the ruins; climb ~30 min.', lat: 15.3320, lng: 76.4710 },
      ],
      // Day 16
      [
        { n: 'Hemakuta Hill temples', c: A, notes: '[activity] Early morning; 9th–11th c. group of small shrines.', lat: 15.3358, lng: 76.4590 },
        { n: 'Virupaksha Temple', c: A, notes: '[activity] Living temple (7th c.); ~9:00–13:00, 17:00–20:00.', lat: 15.3355, lng: 76.4600 },
        { n: 'Hampi Bazaar & Courtesan\'s Street', c: S, notes: '[shopping] Bazaar, Tungabhadra ghats.', lat: 15.3354, lng: 76.4630 },
        { n: 'Sasivekalu & Kadalekalu Ganesha', c: A, notes: '[activity] Monolithic Ganesha shrines.', lat: 15.3330, lng: 76.4660 },
        { n: 'Lakshmi Narasimha & Krishna Temple', c: A, notes: '[activity] 6.7 m Narasimha monolith; Krishna Temple bazaar ruins.', lat: 15.3305, lng: 76.4695 },
        { n: 'Achyutaraya Temple', c: A, notes: '[activity] Sunset-lit Vijayanagara temple at the end of the bazaar.', lat: 15.3370, lng: 76.4680 },
      ],
      // Day 17
      [
        { n: 'Vittala Temple & Stone Chariot', c: A, notes: '[activity] UNESCO; musical pillars; go at opening (~8:30). ASI ticket.', lat: 15.3418, lng: 76.4745 },
        { n: 'Royal Enclosure (Mahanavami Dibba)', c: A, notes: '[activity] Palace platforms and stepped tank.', lat: 15.3160, lng: 76.4690 },
        { n: 'Zenana Enclosure & Lotus Mahal', c: A, notes: '[activity] Indo-Islamic pavilion; watchtowers.', lat: 15.3190, lng: 76.4745 },
        { n: 'Elephant Stables', c: A, notes: '[activity] 11 domed chambers for royal elephants.', lat: 15.3185, lng: 76.4760 },
        { n: 'Tungabhadra coracle ride', c: X, notes: '[activity] Optional circular boat ride; negotiate price.', lat: 15.3380, lng: 76.4700 },
      ],
      // Day 18
      [
        { n: 'Durga Temple Complex, Aihole', c: A, notes: '[activity] Early Chalukya apsidal temple; hundreds of temples around.', lat: 16.0204, lng: 75.8800 },
        { n: 'Lad Khan & Meguti Temples, Aihole', c: A, notes: '[activity] Lad Khan (c. 5th c.); Meguti Jain temple hilltop view.', lat: 16.0214, lng: 75.8780 },
        { n: 'Pattadakal Group of Monuments', c: A, notes: '[activity] UNESCO; Virupaksha and Sangameshwara temples; ASI.', lat: 15.9486, lng: 75.8164 },
        { n: 'Badami hotel (nights 18–19)', c: H, notes: '[lodging] Hotel Mayura Chalukya or similar.', lat: 15.9150, lng: 75.6760 },
        { n: 'Badami dinner', c: R, notes: '[food] North-Karnataka thali: jolada rotti, ennegai brinjal.', lat: 15.9165, lng: 75.6770 },
      ],
      // Day 19
      [
        { n: 'Badami Cave Temples', c: A, notes: '[activity] Four rock-cut caves; Cave 3 Vishnu; ASI ticket; close ~18:00.', lat: 15.9210, lng: 75.6860 },
        { n: 'Agastya Lake & Bhutanatha Temples', c: A, notes: '[activity] Sandstone steps; golden hour reflection.', lat: 15.9220, lng: 75.6870 },
        { n: 'Badami Fort (Upper & Lower Shivalaya)', c: A, notes: '[activity] Hilltop forts above the caves.', lat: 15.9190, lng: 75.6850 },
        { n: 'Archaeological Museum, Badami', c: A, notes: '[activity] Chalukya sculptures; 10:00–17:00.', lat: 15.9200, lng: 75.6830 },
      ],
      // Day 20
      [
        { n: 'Private driver — Badami → Hubballi', c: T, notes: '[transport] ~3 h; book a late-morning flight or later.', lat: 15.6000, lng: 75.4000 },
        { n: 'Hubballi Airport (HBX)', c: T, notes: '[transport] Fly HBX→BLR (~1 h 10).', lat: 15.3617, lng: 75.0849 },
        { n: 'Bengaluru hotel (night 20)', c: H, notes: '[lodging] City (MG Road) or near BLR airport for early flight.', lat: 12.9716, lng: 77.5946 },
        { n: 'Vidhana Soudha & Cubbon Park', c: N, notes: '[activity] Optional afternoon: neoclassical state capitol and park.', lat: 12.9763, lng: 77.5929 },
        { n: 'VV Puram Food Street', c: R, notes: '[food] Dosa, chaat and sweets (evening).', lat: 12.9477, lng: 77.5740 },
      ],
      // Day 21
      [
        { n: 'Bengaluru hotel check-out', c: H, notes: '[lodging] Allow ~1.5 h to BLR in traffic.', lat: 12.9716, lng: 77.5946 },
        { n: 'Kempegowda International Airport (BLR)', c: T, notes: '[transport] Terminal 2, fly BLR→ORD (open-jaw return).', lat: 13.1986, lng: 77.7066 },
        { n: 'Chicago O\'Hare (ORD)', c: T, notes: '[transport] Arrival home.', lat: 41.9742, lng: -87.9073 },
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
    INSERT INTO trips (user_id, title, description, start_date, end_date, currency, reminder_days, cover_image, sort_order)
    VALUES (?, ?, ?, NULL, NULL, ?, 3, ?, ?)
  `)
  const insertDay = db.prepare(`
    INSERT INTO days (trip_id, day_number, date, title, notes) VALUES (?, ?, NULL, ?, ?)
  `)
  const bumpSortOrder = db.prepare(
    'UPDATE trips SET sort_order = COALESCE(sort_order, 999) + 1 WHERE user_id = ?',
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

  // Push existing trips down by 1 so the new trip can take sort_order 0 (top of planned list).
  // Only when the trip is actually new, so re-runs stay idempotent.
  if (TRIPS.some((t) => !existing.has(t.title))) {
    const bumped = bumpSortOrder.run(USER_ID)
    console.log(`Bumped sort_order +1 on ${bumped.changes} existing trips`)
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
  TRIPS.forEach((trip) => {
    const out = seedOne(trip, 0)
    console.log(`  → ${out.places} places`)
    totalPlaces += out.places
  })

  console.log(`\nDone. ${totalPlaces} places across ${TRIPS.length} trips.`)
  db.close()
}

main()
