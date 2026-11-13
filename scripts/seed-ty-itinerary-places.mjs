#!/usr/bin/env node
/**
 * Fill planned trips with place stops + day assignments (Middle East style).
 * Idempotent: clears existing places for these trips, then re-seeds.
 *
 * Usage: node scripts/seed-ty-itinerary-places.mjs
 */
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../server/data/travel.db')

// Categories: 1 Hotel, 2 Restaurant, 3 Attraction, 4 Shopping, 5 Transport,
// 6 Activity, 7 Bar/Cafe, 8 Beach, 9 Nature, 10 Other
const H = 1, R = 2, A = 3, S = 4, T = 5, X = 6, C = 7, N = 9, O = 10

/** @typedef {{ n: string, c?: number, notes?: string, lat?: number, lng?: number }} Stop */
/** @type {Record<string, Stop[][]>} day-indexed stops (index 0 = day 1) */
const TRIPS = {
  'Central Asia: Kazakhstan, Kyrgyzstan & Uzbekistan': [
    [
      { n: 'ORD → ALA', c: T, notes: '[transport] Depart Chicago → Almaty. ORD → ? → ALA overnight transit.' },
    ],
    [
      { n: 'Arrive Almaty', c: T, notes: '[transport] Arrival ALA; transfer to hotel.', lat: 43.2389, lng: 76.9455 },
      { n: 'Hotel check-in — Almaty', c: H, notes: '[lodging] Check into hotel.' },
      { n: 'Zhibek Zholy pedestrian street', c: A, notes: '[activity] Walk the central pedestrian street.', lat: 43.2567, lng: 76.9286 },
      { n: 'Central tavern dinner', c: R, notes: '[food] Highly rated tavern near Zhibek Zholy. Try shashlik or beshbarmak.' },
    ],
    [
      { n: '28 Panfilov Guardsmen Park', c: N, notes: '[activity] Morning stroll; Zenkov Cathedral.', lat: 43.2588, lng: 76.9538 },
      { n: 'Zenkov Cathedral', c: A, notes: '[activity] Colorful wooden cathedral in Panfilov Park.', lat: 43.2589, lng: 76.9532 },
      { n: 'Green Bazaar', c: S, notes: '[food] Flatbreads, dried fruits, nuts, horse cheeses from vendors.', lat: 43.2625, lng: 76.9572 },
      { n: 'Kok Tobe Hill cable car', c: X, notes: '[activity] Scenic cable car; panoramic views vs Tien Shan.', lat: 43.2307, lng: 76.9755 },
      { n: 'Laghman or samsa dinner', c: R, notes: '[food] Hand-pulled laghman or savory samsa at a central restaurant.' },
    ],
    [
      { n: 'Medeu cable car', c: X, notes: '[activity] Morning cable car up to Medeu rink/valley.', lat: 43.1572, lng: 77.0586 },
      { n: 'Shymbulak', c: N, notes: '[activity] Continue to Shymbulak; mountain viewpoints and easy walking.', lat: 43.1281, lng: 77.0806 },
      { n: 'Return Almaty dinner', c: R, notes: '[food] Return to Almaty for dinner.' },
    ],
    [
      { n: 'Kaindy Lake day trip', c: N, notes: '[activity] Full-day trip to Kaindy (sunken forest) + Kolsai Lakes. Return evening.', lat: 42.9833, lng: 78.4667 },
      { n: 'Kolsai Lakes', c: N, notes: '[activity] Alpine lakes circuit with Kaindy.', lat: 42.9333, lng: 78.3167 },
    ],
    [
      { n: 'Almaty → Bishkek land border', c: T, notes: '[transport] Private car or shared transit. Keep morning flexible for border queues.' },
      { n: 'Hotel check-in — Bishkek', c: H, notes: '[lodging] Check into hotel.', lat: 42.8746, lng: 74.5698 },
      { n: 'Ala-Too Square', c: A, notes: '[activity] Soviet-style square; Manas changing of the guard.', lat: 42.8766, lng: 74.6036 },
      { n: 'Osh Bazaar', c: S, notes: '[activity] Felt handicrafts and spices.', lat: 42.8740, lng: 74.5670 },
      { n: 'Manty dinner', c: R, notes: '[food] Steamed manty with local tea at a central cafe.' },
    ],
    [
      { n: 'Ala-Archa National Park', c: N, notes: '[activity] ~45 min south of Bishkek; hike/viewpoint day.', lat: 42.6333, lng: 74.4833 },
      { n: 'Bishkek parks & markets', c: A, notes: '[activity] Relaxed afternoon back in the capital.' },
      { n: 'Ashlyam-fu or noodles', c: R, notes: '[food] Cold spicy ashlyam-fu (Karakol style) or stir-fried noodles.' },
    ],
    [
      { n: 'Burana Tower', c: A, notes: '[activity] Historical tower + open-air balbal field.', lat: 42.7469, lng: 75.2506 },
      { n: 'Flight/connection to Tashkent', c: T, notes: '[transport] Afternoon flight or regional connection to TAS.' },
      { n: 'Hotel check-in — Tashkent', c: H, notes: '[lodging] Arrive, clear customs. Collect hotel registration slip (mandatory).', lat: 41.2995, lng: 69.2401 },
    ],
    [
      { n: 'Hazrati Imam Complex', c: A, notes: '[activity] Library vault: Uthman Quran (closed Sundays).', lat: 41.3386, lng: 69.2425 },
      { n: 'Besh Qozon plov', c: R, notes: '[food] Watch kazans; wedding-style plov.', lat: 41.3267, lng: 69.2895 },
      { n: 'Chorsu Bazaar', c: S, notes: '[activity] Dome bazaar; tandoor non bread.', lat: 41.3265, lng: 69.2350 },
      { n: 'Tashkent Metro tour', c: A, notes: '[activity] Kosmonavtlar and Alisher Navoi stations.', lat: 41.3111, lng: 69.2797 },
    ],
    [
      { n: 'Afrosiyob to Samarkand', c: T, notes: '[transport] Bullet train ~2h. Book 4+ weeks early.', lat: 39.6542, lng: 66.9597 },
      { n: 'Hotel check-in — Samarkand', c: H, notes: '[lodging] Afternoon check-in.' },
      { n: 'Registan Square', c: A, notes: '[activity] Ulugh Beg Madrasa; return for night AV show 8:30 / laser 9:00.', lat: 39.6549, lng: 66.9756 },
      { n: 'Siab Bazaar', c: S, notes: '[activity] Local market near the old city.', lat: 39.6600, lng: 66.9800 },
      { n: 'Bibi-Khanym Mosque', c: A, notes: '[activity] Colossal ruins at dusk; old town walk.', lat: 39.6608, lng: 66.9794 },
      { n: 'Samarkand plov or kebabs', c: R, notes: '[food] Layered Samarkand plov or spiced kebabs in the old city.' },
    ],
    [
      { n: 'Shah-i-Zinda', c: A, notes: '[activity] Morning necropolis walk.', lat: 39.6631, lng: 66.9878 },
      { n: 'Gur-e-Amir Mausoleum', c: A, notes: '[activity] Timur’s tomb.', lat: 39.6483, lng: 66.9689 },
      { n: 'Ulugh Beg Observatory', c: A, notes: '[activity] Stone remains of the observatory.', lat: 39.6747, lng: 67.0056 },
      { n: 'Manti near Registan', c: R, notes: '[food] Manti or savory pastries at a family-run old-town restaurant.' },
    ],
    [
      { n: 'Afrosiyob to Bukhara', c: T, notes: '[transport] Train west ~1.5h.', lat: 39.7681, lng: 64.4556 },
      { n: 'Labi Hovuz / Lyabi-Hauz', c: A, notes: '[activity] Mulberry-lined stone pool; night walk when lit.', lat: 39.7750, lng: 64.4200 },
      { n: 'Toki Sarrofon', c: S, notes: '[activity] Vaulted trading dome — carpets, spices, copper.', lat: 39.7745, lng: 64.4215 },
      { n: 'Shurpa by Lyabi-Hauz', c: R, notes: '[food] Cafe overlooking the pool; lamb shurpa + green tea.' },
    ],
    [
      { n: 'Kalon Mosque & Minaret', c: A, notes: '[activity] Grand square; return for night walk.', lat: 39.7756, lng: 64.4222 },
      { n: 'Ark of Bukhara', c: A, notes: '[activity] Fortress citadel.', lat: 39.7778, lng: 64.4111 },
      { n: 'Zindon Prison', c: A, notes: '[activity] Historic prison / bug pit.' },
      { n: 'Chor Minor', c: A, notes: '[activity] Four turquoise towers gatehouse.', lat: 39.7753, lng: 64.4372 },
      { n: 'Caravanserai dinner', c: R, notes: '[food] Late dinner of skewers and rice stews in a historic courtyard.' },
    ],
    [
      { n: 'Sitorai Mokhi-Khosa', c: A, notes: '[activity] Short excursion outside center — summer palace.', lat: 39.8139, lng: 64.4500 },
      { n: 'Bukhara breathing-room day', c: X, notes: '[activity] Bazaar alleys, hammam, or reading by historic pools.' },
    ],
    [
      { n: 'Bukhara → Khiva transit', c: T, notes: '[transport] Scenic 5–6h train or private transfer across Kyzylkum Desert.' },
      { n: 'Guesthouse — Ichan-Kala', c: H, notes: '[lodging] Stay inside or adjacent to the walled citadel.', lat: 41.3783, lng: 60.3594 },
      { n: 'Ichan-Kala sunset walls', c: A, notes: '[activity] Sunset reflecting off historic mud walls.', lat: 41.3775, lng: 60.3600 },
    ],
    [
      { n: 'Kalta-Minor Minaret', c: A, notes: '[activity] Iconic unfinished turquoise minaret.', lat: 41.3781, lng: 60.3597 },
      { n: 'Juma Mosque', c: A, notes: '[activity] Forest of carved wooden pillars.', lat: 41.3772, lng: 60.3614 },
      { n: 'Tash-Khovli Palace', c: A, notes: '[activity] Tiled rooms and royal harem quarters.', lat: 41.3794, lng: 60.3625 },
      { n: 'Kunya-Ark Watchtower', c: A, notes: '[activity] Sunset climb for golden desert-minaret views.', lat: 41.3789, lng: 60.3569 },
      { n: 'Shivit oshi dinner', c: R, notes: '[food] Bright-green dill pasta with beef stew, or savory meat pies.' },
    ],
    [
      { n: 'Toprak-Kala', c: A, notes: '[activity] All-day Khorezm / Karakalpakstan desert fortresses.', lat: 41.9833, lng: 60.8667 },
      { n: 'Ayaz-Kala', c: A, notes: '[activity] Mud fortress ruins on the plains.', lat: 42.0167, lng: 61.0333 },
    ],
    [
      { n: 'Taxi to Urgench (UGC)', c: T, notes: '[transport] ~30 min to Urgench International Airport.' },
      { n: 'UGC → TAS', c: T, notes: '[transport] Domestic flight to Tashkent buffer night.' },
      { n: 'Tashkent buffer evening', c: H, notes: '[lodging] Low-stress evening before international departure.' },
    ],
    [
      { n: 'TAS → ORD', c: T, notes: '[transport] International departure Tashkent → Chicago (via connection).' },
    ],
    [
      { n: 'Arrive ORD', c: T, notes: '[transport] Land Chicago O’Hare.' },
    ],
  ],

  'Southeast Asia: Thailand, Cambodia & Vietnam': [
    [
      { n: 'Grand Palace', c: A, notes: '[activity] Bangkok Grand Palace complex.', lat: 13.7500, lng: 100.4914 },
      { n: 'Wat Phra Kaew', c: A, notes: '[activity] Temple of the Emerald Buddha.', lat: 13.7516, lng: 100.4927 },
      { n: 'Wat Pho', c: A, notes: '[activity] Reclining Buddha.', lat: 13.7466, lng: 100.4930 },
      { n: 'Rajadamnern Muay Thai', c: X, notes: '[activity] Evening bout; ~$80 ticket.', lat: 13.7600, lng: 100.5080 },
      { n: 'Hotel — Khao San / Rambuttri', c: H, notes: '[lodging] e.g. Rambuttri Village Inn ~$40/night.', lat: 13.7611, lng: 100.4947 },
    ],
    [
      { n: 'Wat Arun sunrise', c: A, notes: '[activity] Sunrise at Temple of Dawn.', lat: 13.7437, lng: 100.4888 },
      { n: 'Amulet Market (Tha Phrachan)', c: S, notes: '[activity] Tha Phrachan amulet market.' },
      { n: 'Tha Tian Market', c: S, notes: '[activity] Riverside market near Wat Pho.' },
      { n: 'Bangkok National Museum', c: A, notes: '[activity] Major Thai history/art museum.', lat: 13.7580, lng: 100.4920 },
      { n: 'Yaowarat Chinatown', c: R, notes: '[food] Evening street food crawl.', lat: 13.7400, lng: 100.5100 },
    ],
    [
      { n: 'Ayutthaya day trip', c: T, notes: '[transport] Train ~$2/1h; tuk-tuk ~$20 for ruins circuit.', lat: 14.3692, lng: 100.5877 },
      { n: 'Wat Mahathat', c: A, notes: '[activity] Buddha head in tree roots.' },
      { n: 'Wat Chaiwatthanaram', c: A, notes: '[activity] Sunset temple on the river.' },
      { n: 'Wat Phra Si Sanphet', c: A, notes: '[activity] Royal temple ruins.' },
      { n: 'Wat Lokayasutharam', c: A, notes: '[activity] Reclining Buddha.' },
      { n: 'Wat Yai Chaya Mongkol', c: A, notes: '[activity] Large chedi complex.' },
      { n: 'Bang Pa-In Palace', c: A, notes: '[activity] Summer palace stop.', lat: 14.2322, lng: 100.5794 },
    ],
    [
      { n: 'BKK → CNX flight', c: T, notes: '[transport] ~$50, ~1h.', lat: 18.7883, lng: 98.9853 },
      { n: 'Doi Suthep', c: A, notes: '[activity] Songthaew ~$5 up; ~1h temple trek.', lat: 18.8050, lng: 98.9217 },
      { n: 'Hotel — Chiang Mai Old City', c: H, notes: '[lodging] e.g. De Chai The Colonial House ~$50 near moat.', lat: 18.7883, lng: 98.9853 },
    ],
    [
      { n: 'Elephant Jungle Sanctuary', c: X, notes: '[activity] Ethical elephant day ~$80.' },
      { n: 'Wat Chedi Luang', c: A, notes: '[activity] Historic ruined chedi.', lat: 18.7869, lng: 98.9867 },
      { n: 'Wat Phra Singh', c: A, notes: '[activity] Mosaic Buddha / Woramahawihan.', lat: 18.7886, lng: 98.9819 },
      { n: 'Wat Sri Suphan (Silver Temple)', c: A, notes: '[activity] Silver-plated temple.', lat: 18.7775, lng: 98.9794 },
      { n: 'Optional: Chiang Rai day trip', c: X, notes: '[activity] Alt day: minivan ~$40, 8–10h RT — White Temple + Rong Suea Ten.' },
    ],
    [
      { n: 'Sukhothai ruins', c: A, notes: '[activity] Bus ~5h/$20 RT or flight ~$60; bike rental ~$5.', lat: 17.0167, lng: 99.7000 },
    ],
    [
      { n: 'Doi Inthanon', c: N, notes: '[activity] National park hikes and waterfalls.', lat: 18.5886, lng: 98.4869 },
      { n: 'Rong Suea Ten viewpoint', c: A, notes: '[activity] Tiger temple views if not done on Chiang Rai day.' },
    ],
    [
      { n: 'CNX → BKK → REP', c: T, notes: '[transport] Flights ~$100, ~2h total to Siem Reap.', lat: 13.4105, lng: 103.8666 },
      { n: 'Angkor Wat sunrise', c: A, notes: '[activity] Full main temple explore. 3-day pass ~$62.', lat: 13.4125, lng: 103.8667 },
      { n: 'Hotel — Pub Street area', c: H, notes: '[lodging] e.g. Onederz Hostel ~$25. Remork/bike ~$20/day.' },
    ],
    [
      { n: 'Bayon Temple', c: A, notes: '[activity] Faces of Bayon.', lat: 13.4411, lng: 103.8592 },
      { n: 'Ta Prohm', c: A, notes: '[activity] Jungle-strangled ruins.', lat: 13.4347, lng: 103.8894 },
    ],
    [
      { n: 'Beng Mealea', c: A, notes: '[activity] Overgrown jungle Angkor; tuk-tuk ~1h, ~$5.', lat: 13.4750, lng: 104.2367 },
    ],
    [
      { n: 'Angkor Thom bike paths', c: X, notes: '[activity] Gates of Angkor Thom by bike.', lat: 13.4417, lng: 103.8597 },
      { n: 'Preah Khan', c: A, notes: '[activity] Extensive jungle temple.', lat: 13.4619, lng: 103.8717 },
    ],
    [
      { n: 'Artisans Angkor / markets', c: S, notes: '[activity] Free morning markets and crafts.' },
      { n: 'Giant Ibis to Phnom Penh', c: T, notes: '[transport] Bus ~$20, ~6h.', lat: 11.5564, lng: 104.9282 },
    ],
    [
      { n: 'Tuol Sleng (S21)', c: A, notes: '[activity] Genocide Museum.', lat: 11.5495, lng: 104.9170 },
      { n: 'Royal Palace', c: A, notes: '[activity] Phnom Penh Royal Palace.', lat: 11.5633, lng: 104.9311 },
      { n: 'Silver Pagoda', c: A, notes: '[activity] Within palace grounds.' },
      { n: 'Hotel — Riverside', c: H, notes: '[lodging] e.g. Billabong Hostel ~$30.' },
    ],
    [
      { n: 'National Museum of Cambodia', c: A, notes: '[activity] Sculpture and archaeology.', lat: 11.5650, lng: 104.9290 },
      { n: 'Choeung Ek Killing Fields', c: A, notes: '[activity] Genocidal Center.', lat: 11.4844, lng: 104.9019 },
      { n: 'Wat Phnom', c: A, notes: '[activity] City’s namesake hill temple.', lat: 11.5761, lng: 104.9228 },
    ],
    [
      { n: 'PNH → HAN flight', c: T, notes: '[transport] ~$100 to Hanoi.', lat: 21.0285, lng: 105.8542 },
      { n: 'Hanoi Old Quarter', c: A, notes: '[activity] Wander Old Quarter streets.', lat: 21.0341, lng: 105.8500 },
      { n: 'Hoan Kiem Lake', c: N, notes: '[activity] Lake and Ngoc Son area.', lat: 21.0288, lng: 105.8520 },
      { n: 'Hotel — Old Quarter', c: H, notes: '[lodging] e.g. Hanoi City Hostel ~$25.' },
    ],
    [
      { n: 'Ninh Binh / Trang An', c: N, notes: '[activity] Train/bus ~2h/$10; rice terraces, caves, hikes.', lat: 20.2506, lng: 105.9745 },
      { n: 'Ho Chi Minh Mausoleum', c: A, notes: '[activity] Return Hanoi; mausoleum visit.', lat: 21.0368, lng: 105.8347 },
    ],
    [
      { n: 'Water puppets & markets', c: X, notes: '[activity] Near Hanoi train station area.' },
      { n: 'Temple of Literature', c: A, notes: '[activity] Văn Miếu.', lat: 21.0280, lng: 105.8355 },
    ],
    [
      { n: 'HAN → DAD flight', c: T, notes: '[transport] ~$80, ~1h to Da Nang / Hoi An.', lat: 15.8801, lng: 108.3380 },
      { n: 'Hoi An lantern old town', c: A, notes: '[activity] Ancient streets and tailor shops.', lat: 15.8801, lng: 108.3380 },
      { n: 'Hotel — Hoi An Old Town', c: H, notes: '[lodging] e.g. Hoi An TNT Villa ~$30.' },
    ],
    [
      { n: 'My Son Sanctuary', c: A, notes: '[activity] Cham ruins day trip ~$20 bus/guide.', lat: 15.7644, lng: 108.1233 },
      { n: 'Chùa Cầu (Japanese Bridge)', c: A, notes: '[activity] Iconic covered bridge.', lat: 15.8777, lng: 108.3278 },
    ],
    [
      { n: 'Hoi An markets & halls', c: A, notes: '[activity] Japanese Bridge area, markets, assembly halls.' },
    ],
    [
      { n: 'DAD → SGN', c: T, notes: '[transport] ~$80 to Ho Chi Minh City.', lat: 10.8231, lng: 106.6297 },
      { n: 'Cu Chi Tunnels', c: X, notes: '[activity] Crawl/history tour ~$20.', lat: 11.0900, lng: 106.4500 },
      { n: 'War Remnants Museum', c: A, notes: '[activity] District 1 museum.', lat: 10.7798, lng: 106.6923 },
      { n: 'Ben Thanh Market', c: S, notes: '[activity] Central market.', lat: 10.7725, lng: 106.6980 },
      { n: 'Independence Palace', c: A, notes: '[activity] Reunification Palace.', lat: 10.7770, lng: 106.6953 },
      { n: 'SGN → BKK → ORD', c: T, notes: '[transport] Homeward flights via Bangkok.' },
    ],
  ],

  'Greece & the Balkans: Athens to Sarajevo': [
    [{ n: 'ORD → ATH', c: T, notes: '[transport] Depart Chicago to Athens.' }],
    [
      { n: 'Arrive Athens', c: T, notes: '[transport] Arrival; settle in.', lat: 37.9838, lng: 23.7275 },
      { n: 'Plaka district', c: A, notes: '[activity] Explore Plaka lanes.', lat: 37.9725, lng: 23.7300 },
      { n: 'Souvlaki & mezze dinner', c: R, notes: '[food] Souvlaki, grilled meats, mezze.' },
      { n: 'Hotel — Koukaki', c: H, notes: '[lodging] Base in Koukaki District.' },
    ],
    [
      { n: 'Acropolis & Parthenon', c: A, notes: '[activity] Parthenon, Erechtheion, Theater of Dionysus.', lat: 37.9715, lng: 23.7267 },
      { n: 'Acropolis Museum', c: A, notes: '[activity] Modern museum below the rock.', lat: 37.9689, lng: 23.7285 },
    ],
    [
      { n: 'Delphi — Sanctuary of Apollo', c: A, notes: '[activity] Full Delphi excursion: sanctuary, theater, stadium, museum.', lat: 38.4824, lng: 22.5010 },
    ],
    [
      { n: 'Ancient Agora', c: A, notes: '[activity] Classic agora ruins.', lat: 37.9750, lng: 23.7225 },
      { n: 'Roman Forum', c: A, notes: '[activity] Roman Agora / Tower of the Winds area.' },
      { n: 'National Archaeological Museum', c: A, notes: '[activity] Greece’s top archaeology museum.', lat: 37.9891, lng: 23.7323 },
      { n: 'Train Athens → Kalabaka', c: T, notes: '[transport] Afternoon train toward Meteora.' },
    ],
    [
      { n: 'Meteora monasteries', c: A, notes: '[activity] Rock pillars and Byzantine monasteries.', lat: 39.7142, lng: 21.6300 },
      { n: 'Hotel — Kastraki Village', c: H, notes: '[lodging] Base under the rocks.' },
    ],
    [
      { n: 'More Meteora monasteries', c: A, notes: '[activity] Additional monastery visits.' },
      { n: 'Transit to Zagori', c: T, notes: '[transport] Continue west to Zagori region.' },
    ],
    [
      { n: 'Zagori stone villages', c: A, notes: '[activity] Stone villages and Ottoman arched bridges.', lat: 39.8500, lng: 20.7000 },
      { n: 'Zagori village guesthouse', c: H, notes: '[lodging] Village guesthouse base.' },
    ],
    [
      { n: 'Vikos Gorge hike', c: N, notes: '[activity] Hike sections of Vikos Gorge.', lat: 39.9000, lng: 20.7500 },
      { n: 'Continue toward North Macedonia', c: T, notes: '[transport] Northbound transit.' },
    ],
    [
      { n: 'Lake Ohrid promenade', c: N, notes: '[activity] Lakeshore walk.', lat: 41.1231, lng: 20.8016 },
      { n: 'Church of Saint John at Kaneo', c: A, notes: '[activity] Iconic clifftop church.', lat: 41.1108, lng: 20.7889 },
      { n: 'Hotel — Ohrid Old Town', c: H, notes: '[lodging] Old Town base.' },
    ],
    [
      { n: 'Tsar Samuel Fortress', c: A, notes: '[activity] Hilltop fortress.', lat: 41.1147, lng: 20.7900 },
      { n: 'Ancient Theatre of Ohrid', c: A, notes: '[activity] Hellenistic/Roman theatre.' },
      { n: 'Ohrid medieval churches', c: A, notes: '[activity] Additional church visits.' },
      { n: 'Cross into Albania', c: T, notes: '[transport] Border crossing toward Gjirokastër.' },
    ],
    [
      { n: 'Gjirokastër old town', c: A, notes: '[activity] Steep cobbled streets.', lat: 40.0758, lng: 20.1389 },
      { n: 'Gjirokastër Fortress', c: A, notes: '[activity] Hilltop fortress views.' },
      { n: 'Hotel — Ottoman mansion', c: H, notes: '[lodging] Traditional Ottoman mansion stay.' },
    ],
    [
      { n: 'Tower houses & Drino Valley', c: A, notes: '[activity] Fortified tower houses; valley views.' },
    ],
    [
      { n: 'Travel to Montenegro / Kotor', c: T, notes: '[transport] Overland to Bay of Kotor.', lat: 42.4247, lng: 18.7712 },
      { n: 'Kotor Old Town evening', c: A, notes: '[activity] Walled Old Town stroll.' },
      { n: 'Hotel — Kotor Old Town', c: H, notes: '[lodging] Stay inside/near walls.' },
    ],
    [
      { n: 'San Giovanni Fortress hike', c: X, notes: '[activity] Hike to fortress above Kotor.' },
      { n: 'Perast', c: A, notes: '[activity] Bay town visit.', lat: 42.4869, lng: 18.6986 },
      { n: 'Our Lady of the Rocks', c: A, notes: '[activity] Island church in the bay.' },
    ],
    [
      { n: 'Arrive Dubrovnik', c: T, notes: '[transport] Cross into Croatia.', lat: 42.6507, lng: 18.0944 },
      { n: 'Dubrovnik Old Town', c: A, notes: '[activity] Fortified gates and squares.' },
      { n: 'Hotel — Dubrovnik Old Town', c: H, notes: '[lodging] Old Town base.' },
    ],
    [
      { n: 'City Walls circuit', c: X, notes: '[activity] Walk atop medieval walls.' },
      { n: 'Fort Lovrijenac', c: A, notes: '[activity] Fortress outside the walls.', lat: 42.6408, lng: 18.1047 },
    ],
    [
      { n: 'Mostar Old Bazaar', c: A, notes: '[activity] Historic bazaar streets.', lat: 43.3438, lng: 17.8078 },
      { n: 'Stari Most', c: A, notes: '[activity] Iconic Old Bridge.', lat: 43.3372, lng: 17.8150 },
      { n: 'Hotel — Mostar Old Bazaar', c: H, notes: '[lodging] Bazaar-area stay.' },
    ],
    [
      { n: 'Blagaj Tekke', c: A, notes: '[activity] Dervish monastery at Buna spring.', lat: 43.2572, lng: 17.8886 },
      { n: 'Optional Kravica Waterfalls', c: N, notes: '[activity] Optional waterfall stop.', lat: 43.1561, lng: 17.6086 },
    ],
    [
      { n: 'Arrive Sarajevo', c: T, notes: '[transport] Transit to Sarajevo.', lat: 43.8563, lng: 18.4131 },
      { n: 'Baščaršija', c: A, notes: '[activity] Ottoman bazaar quarter.' },
      { n: 'Ćevapi & Bosnian coffee', c: R, notes: '[food] Classic Sarajevo welcome meal.' },
      { n: 'Hotel — Sarajevo Old Town', c: H, notes: '[lodging] Old Town base.' },
    ],
    [
      { n: 'Latin Bridge', c: A, notes: '[activity] Historic bridge.', lat: 43.8578, lng: 18.4289 },
      { n: 'City Hall (Vijećnica)', c: A, notes: '[activity] Restored pseudo-Moorish hall.' },
      { n: 'Tunnel of Hope Museum', c: A, notes: '[activity] Siege-era tunnel museum.', lat: 43.8197, lng: 18.3367 },
    ],
    [
      { n: 'Mount Trebević', c: N, notes: '[activity] Cable car / views over the city.', lat: 43.8200, lng: 18.4500 },
      { n: 'Olympic bobsled track', c: X, notes: '[activity] Abandoned 1984 track walk.' },
      { n: 'Sarajevo cafés', c: C, notes: '[food] Open café afternoon.' },
    ],
    [{ n: 'Depart SJJ', c: T, notes: '[transport] Flight via European hub.' }],
    [{ n: 'Arrive ORD', c: T, notes: '[transport] Land Chicago.' }],
  ],

  'Japan: Tokyo, Kyoto, Osaka & Kanazawa': [
    [
      { n: 'ORD → NRT', c: T, notes: '[transport] ~13h transpacific.' },
      { n: 'Narita Express → Shinjuku', c: T, notes: '[transport] N’EX ~1h, ~¥3,000.', lat: 35.6896, lng: 139.7006 },
      { n: 'Hotel — Shinjuku', c: H, notes: '[lodging] Shinjuku-area check-in.' },
      { n: 'Asakusa / Senso-ji', c: A, notes: '[activity] Day + illuminated night; founded 645.', lat: 35.7148, lng: 139.7967 },
      { n: 'Nakamise Shopping Street', c: S, notes: '[activity] Traditional snacks and souvenirs.' },
      { n: 'Sumida River walk', c: N, notes: '[activity] Riverside stroll.' },
      { n: 'Tempura Daikokuya or Asakusa Imahan', c: R, notes: '[food] Tempura or sukiyaki dinner.' },
      { n: 'Tokyo Skytree', c: A, notes: '[activity] Night view ~¥3,100.', lat: 35.7101, lng: 139.8107 },
    ],
    [
      { n: 'Meiji Shrine', c: A, notes: '[activity] Forested shrine; Yoyogi trails.', lat: 35.6764, lng: 139.6993 },
      { n: 'Takeshita Street (Harajuku)', c: S, notes: '[activity] Street fashion crawl.', lat: 35.6717, lng: 139.7031 },
      { n: 'Afuri Ramen', c: R, notes: '[food] Lunch ramen.' },
      { n: 'Shibuya Crossing & Hachiko', c: A, notes: '[activity] Scramble + statue.', lat: 35.6595, lng: 139.7005 },
      { n: 'Shibuya Sky', c: A, notes: '[activity] City observation deck.' },
      { n: 'Uobei or Gyukatsu Motomura', c: R, notes: '[food] Conveyor sushi or gyukatsu dinner.' },
    ],
    [
      { n: 'Tokyo National Museum', c: A, notes: '[activity] 4+ hours — armor, pottery, Buddhist sculpture.', lat: 35.7188, lng: 139.7765 },
      { n: 'Ueno Park', c: N, notes: '[activity] Park around the museums.', lat: 35.7142, lng: 139.7731 },
      { n: 'Tonkatsu Yamabe', c: R, notes: '[food] Lunch tonkatsu.' },
      { n: 'PDG / Otachu (Akihabara)', c: S, notes: '[activity] Pokémon cards — same building.' },
      { n: 'YK Trading Card Shop', c: S, notes: '[activity] Akihabara card stop.' },
      { n: 'Valuable Card Tokyo', c: S, notes: '[activity] Cash only.' },
      { n: 'El Dorado', c: S, notes: '[activity] Card shop.' },
      { n: 'Hareruya 2', c: S, notes: '[activity] Card shop.' },
      { n: '福福トレカ秋葉原', c: S, notes: '[activity] コレクションカード専門店.' },
      { n: 'Gyukatsu Ichi Ni San', c: R, notes: '[food] Dinner gyukatsu.' },
    ],
    [
      { n: 'teamLab Planets', c: A, notes: '[activity] Pre-book 9:00 AM entry.', lat: 35.6486, lng: 139.7900 },
      { n: 'Toyosu Market area lunch', c: R, notes: '[food] Lunch near Toyosu.' },
      { n: 'Imperial Palace East Gardens', c: N, notes: '[activity] Free gardens stroll.', lat: 35.6869, lng: 139.7531 },
      { n: 'Pokémon Center Tokyo DX', c: S, notes: '[activity] Ginza / Nihonbashi DX.', lat: 35.6800, lng: 139.7700 },
      { n: 'Ginza Kagari', c: R, notes: '[food] Chicken paitan ramen dinner.' },
    ],
    [
      { n: 'Kamakura — Great Buddha', c: A, notes: '[activity] Day trip sites.', lat: 35.3169, lng: 139.5359 },
      { n: 'Hasedera Temple', c: A, notes: '[activity] Hillside temple with views.' },
      { n: 'Tsurugaoka Hachimangu', c: A, notes: '[activity] Main shrine.' },
      { n: 'Komachi Street', c: S, notes: '[activity] Snack street.' },
      { n: 'Optional Daibutsu Hiking Trail', c: N, notes: '[activity] Optional trail between sites.' },
    ],
    [
      { n: 'Tokyo → Hakone', c: T, notes: '[transport] Romancecar or Shinkansen.' },
      { n: 'Hakone Loop', c: X, notes: '[activity] Ropeway, Owakudani, Lake Ashi, Hakone Shrine.', lat: 35.2324, lng: 139.1069 },
      { n: 'Owakudani', c: N, notes: '[activity] Volcanic valley.', lat: 35.2431, lng: 139.0194 },
      { n: 'Ryokan — Hakone', c: H, notes: '[lodging] Traditional ryokan; kaiseki + onsen.' },
    ],
    [
      { n: 'Travel to Kyoto', c: T, notes: '[transport] Hakone/Tokyo → Kyoto.', lat: 35.0116, lng: 135.7681 },
      { n: 'Fushimi Inari (pre-sunrise)', c: A, notes: '[activity] Full 4km summit hike.', lat: 34.9671, lng: 135.7727 },
      { n: 'Kyoto Ramen Sen-no-Kaze', c: R, notes: '[food] Dinner ramen.' },
      { n: 'Hotel — Gion', c: H, notes: '[lodging] Gion District base.' },
    ],
    [
      { n: 'Kiyomizu-dera', c: A, notes: '[activity] Wooden stage temple.', lat: 34.9949, lng: 135.7850 },
      { n: 'Higashiyama / Sannenzaka / Ninenzaka', c: A, notes: '[activity] Historic lanes to Gion.' },
      { n: 'Gion', c: A, notes: '[activity] Geisha district evening.', lat: 35.0037, lng: 135.7755 },
      { n: 'Gion Kappa', c: R, notes: '[food] Dinner in Gion.' },
    ],
    [
      { n: 'Arashiyama Bamboo Grove', c: N, notes: '[activity] Bamboo path.', lat: 35.0170, lng: 135.6716 },
      { n: 'Tenryu-ji', c: A, notes: '[activity] Zen temple gardens.' },
      { n: 'Monkey Park Iwatayama', c: X, notes: '[activity] Hill monkeys + city view.' },
      { n: 'Okochi Sanso Garden', c: N, notes: '[activity] Villa gardens.' },
      { n: 'Arashiyama Yoshimura', c: R, notes: '[food] Dinner.' },
    ],
    [
      { n: 'Nara — Todai-ji Great Buddha', c: A, notes: '[activity] Day trip.', lat: 34.6889, lng: 135.8394 },
      { n: 'Kasuga Taisha', c: A, notes: '[activity] Lantern shrine.' },
      { n: 'Nara Deer Park', c: N, notes: '[activity] Free-roaming deer.' },
      { n: 'Optional Naramachi', c: A, notes: '[activity] Historic merchant district.' },
    ],
    [
      { n: 'Kinkaku-ji', c: A, notes: '[activity] Golden Pavilion.', lat: 35.0394, lng: 135.7292 },
      { n: 'Ryoan-ji', c: A, notes: '[activity] Rock garden.', lat: 35.0345, lng: 135.7183 },
      { n: 'Nijo Castle', c: A, notes: '[activity] Shogun castle.', lat: 35.0142, lng: 135.7481 },
      { n: 'Philosopher’s Path', c: N, notes: '[activity] Canal walk.', lat: 35.0270, lng: 135.7970 },
      { n: 'Kaiseki / Kyoto-style dinner', c: R, notes: '[food] Formal Kyoto dinner.' },
    ],
    [
      { n: 'Kyoto → Kanazawa', c: T, notes: '[transport] Train to Kanazawa.', lat: 36.5613, lng: 136.6562 },
      { n: 'Kenrokuen Garden', c: N, notes: '[activity] One of Japan’s three great gardens.', lat: 36.5622, lng: 136.6622 },
      { n: 'Kanazawa Castle', c: A, notes: '[activity] Castle park next to Kenrokuen.' },
      { n: 'Omicho Market', c: S, notes: '[activity] Seafood market.' },
      { n: 'Seafood dinner — Kanazawa', c: R, notes: '[food] Fresh seafood dinner.' },
    ],
    [
      { n: 'Nagamachi Samurai District', c: A, notes: '[activity] Earthen-wall lanes.' },
      { n: 'Nomura Samurai House', c: A, notes: '[activity] Restored samurai residence.' },
      { n: 'Higashi Chaya District', c: A, notes: '[activity] Teahouse quarter.' },
      { n: 'Optional 21st Century Museum', c: A, notes: '[activity] Contemporary art museum.' },
    ],
    [
      { n: 'Kanazawa → Osaka', c: T, notes: '[transport] Train to Osaka.', lat: 34.6937, lng: 135.5023 },
      { n: 'Osaka Castle', c: A, notes: '[activity] Castle and park.', lat: 34.6873, lng: 135.5262 },
      { n: 'Kuromon Market', c: S, notes: '[food] Market graze.', lat: 34.6650, lng: 135.5065 },
      { n: 'Dotonbori', c: A, notes: '[activity] Neon canal food street.', lat: 34.6687, lng: 135.5013 },
      { n: 'Takoyaki / okonomiyaki / kushikatsu', c: R, notes: '[food] Osaka street-food dinner.' },
    ],
    [
      { n: 'Himeji Castle', c: A, notes: '[activity] Day trip white egret castle.', lat: 34.8394, lng: 134.6939 },
      { n: 'Koko-en Garden', c: N, notes: '[activity] Gardens by the castle.' },
      { n: 'Optional Kobe stop', c: A, notes: '[activity] Optional stop on return.' },
      { n: 'Dotonbori dinner', c: R, notes: '[food] Back in Osaka.' },
    ],
    [
      { n: 'Haruka Express → KIX', c: T, notes: '[transport] Airport express.' },
      { n: 'KIX → ORD', c: T, notes: '[transport] Flight home to Chicago.' },
    ],
  ],
}

// Continued in part 2 file load — remaining trips appended below
Object.assign(TRIPS, {
  'Morocco & Tunisia: Sahara to Carthage': [
    [{ n: 'ORD → CMN', c: T, notes: '[transport] Chicago → Casablanca overnight.' }],
    [
      { n: 'Arrive Casablanca', c: T, notes: '[transport] Land CMN.', lat: 33.5731, lng: -7.5898 },
      { n: 'Hassan II Mosque', c: A, notes: '[activity] Iconic oceanfront mosque.', lat: 33.6085, lng: -7.6326 },
      { n: 'Casablanca Corniche', c: A, notes: '[activity] Waterfront walk.' },
      { n: 'Train to Rabat', c: T, notes: '[transport] ONCF train Casablanca → Rabat.', lat: 34.0209, lng: -6.8416 },
      { n: 'Hotel — Rabat', c: H, notes: '[lodging] Overnight Rabat.' },
    ],
    [
      { n: 'Kasbah of the Udayas', c: A, notes: '[activity] Andalusian-walled kasbah.', lat: 34.0322, lng: -6.8361 },
      { n: 'Andalusian Gardens', c: N, notes: '[activity] Gardens by the kasbah.' },
      { n: 'Hassan Tower', c: A, notes: '[activity] Incomplete minaret landmark.', lat: 34.0242, lng: -6.8225 },
      { n: 'Mausoleum of Mohammed V', c: A, notes: '[activity] Royal mausoleum next to Hassan Tower.' },
      { n: 'Rabat Medina', c: S, notes: '[activity] Medina wander.' },
    ],
    [
      { n: 'Travel to Chefchaouen', c: T, notes: '[transport] North to the blue city.', lat: 35.1688, lng: -5.2636 },
      { n: 'Chefchaouen blue streets', c: A, notes: '[activity] Wander painted medina lanes.' },
      { n: 'Plaza Uta el-Hammam', c: A, notes: '[activity] Main square.' },
      { n: 'Ras El Maa', c: N, notes: '[activity] Spring / waterfall at medina edge.' },
      { n: 'Chefchaouen sunset viewpoint', c: N, notes: '[activity] Spanish Mosque hill or equivalent viewpoint.' },
    ],
    [
      { n: 'Volubilis', c: A, notes: '[activity] Roman mosaics and ruins.', lat: 34.0740, lng: -5.5570 },
      { n: 'Bab Mansour Gate (Meknes)', c: A, notes: '[activity] Monumental gate.', lat: 33.8935, lng: -5.5550 },
      { n: 'Heri es-Souani Granaries', c: A, notes: '[activity] Royal granaries / stables.' },
      { n: 'Mausoleum of Moulay Ismail', c: A, notes: '[activity] Meknes mausoleum.' },
      { n: 'Continue to Fes', c: T, notes: '[transport] Afternoon/evening into Fes.', lat: 34.0181, lng: -5.0078 },
    ],
    [
      { n: 'Fes el-Bali Medina', c: A, notes: '[activity] Labyrinthine old city.', lat: 34.0631, lng: -4.9736 },
      { n: 'Bou Inania Medersa', c: A, notes: '[activity] Marinid madrasa.' },
      { n: 'Chouara Tannery viewpoints', c: A, notes: '[activity] Leather dye pits from terraces.' },
      { n: 'Nejjarine Fountain', c: A, notes: '[activity] Carved fountain / museum area.' },
      { n: 'Al-Attarine Medersa', c: A, notes: '[activity] Tilework madrasa near the spice souk.' },
      { n: 'Souks of Fes', c: S, notes: '[activity] Craft and spice souks.' },
      { n: 'Hotel — Fes', c: H, notes: '[lodging] Fes riad/hotel.' },
    ],
    [
      { n: 'Middle Atlas / Azrou cedars', c: N, notes: '[activity] Drive through cedars and Ziz Valley viewpoints.', lat: 33.4333, lng: -5.2167 },
      { n: 'Arrive Merzouga', c: T, notes: '[transport] Reach Erg Chebbi gateway.', lat: 31.0801, lng: -4.0134 },
    ],
    [
      { n: 'Erg Chebbi dunes', c: N, notes: '[activity] Camel trek or 4x4; Sahara sunset.', lat: 31.1500, lng: -3.9833 },
      { n: 'Desert camp', c: H, notes: '[lodging] Luxury desert camp; Berber music and stargazing.' },
    ],
    [
      { n: 'Erg Chebbi sunrise', c: N, notes: '[activity] Sunrise over the dunes.' },
      { n: 'Todra Gorge hike', c: N, notes: '[activity] Canyon walk.', lat: 31.5850, lng: -5.5950 },
      { n: 'Dades Valley viewpoints', c: N, notes: '[activity] Road of a Thousand Kasbahs viewpoints.', lat: 31.5000, lng: -5.9000 },
      { n: 'Kasbah hotel', c: H, notes: '[lodging] Kasbah-style hotel overnight.' },
    ],
    [
      { n: 'Aït Benhaddou', c: A, notes: '[activity] UNESCO ksar.', lat: 31.0472, lng: -7.1292 },
      { n: 'Tizi n’Tichka Pass', c: T, notes: '[transport] High Atlas crossing toward Marrakech.' },
      { n: 'Arrive Marrakech', c: T, notes: '[transport] Evening arrival.', lat: 31.6295, lng: -7.9811 },
    ],
    [
      { n: 'Bahia Palace', c: A, notes: '[activity] 19th-c palace.', lat: 31.6216, lng: -7.9836 },
      { n: 'Ben Youssef Madrasa', c: A, notes: '[activity] Historic madrasa.', lat: 31.6320, lng: -7.9866 },
      { n: 'Koutoubia Mosque', c: A, notes: '[activity] Landmark minaret (exterior).', lat: 31.6240, lng: -7.9936 },
      { n: 'Marrakech Souks', c: S, notes: '[activity] Medina souks.' },
      { n: 'Jemaa el-Fnaa food stalls', c: R, notes: '[food] Evening square food stalls.', lat: 31.6258, lng: -7.9891 },
    ],
    [
      { n: 'Majorelle Garden', c: N, notes: '[activity] Yves Saint Laurent gardens.', lat: 31.6417, lng: -8.0031 },
      { n: 'Le Jardin Secret', c: N, notes: '[activity] Restored medina garden.' },
      { n: 'Saadian Tombs', c: A, notes: '[activity] Royal tombs.' },
      { n: 'Optional hammam', c: X, notes: '[activity] Traditional bathhouse.' },
      { n: 'Evening flight to Tunis', c: T, notes: '[transport] RAK/CMN → TUN.', lat: 36.8065, lng: 10.1815 },
      { n: 'Hotel — Tunis', c: H, notes: '[lodging] Tunis overnight.' },
    ],
    [
      { n: 'Tunis Medina', c: A, notes: '[activity] Old city lanes.', lat: 36.7992, lng: 10.1713 },
      { n: 'Zitouna Mosque (exterior)', c: A, notes: '[activity] Great Mosque exterior.' },
      { n: 'Bardo National Museum', c: A, notes: '[activity] World-class Roman mosaics.', lat: 36.8094, lng: 10.1342 },
    ],
    [
      { n: 'Punic Ports', c: A, notes: '[activity] Carthage harbors.', lat: 36.8450, lng: 10.3250 },
      { n: 'Antonine Baths', c: A, notes: '[activity] Massive Roman baths.', lat: 36.8536, lng: 10.3375 },
      { n: 'Byrsa Hill', c: A, notes: '[activity] Acropolis of Carthage.' },
      { n: 'Carthage Museum', c: A, notes: '[activity] Site museum.' },
      { n: 'Roman Villas', c: A, notes: '[activity] Villa mosaics.' },
    ],
    [
      { n: 'Sidi Bou Said', c: A, notes: '[activity] Blue-and-white village; Gulf views.', lat: 36.8700, lng: 10.3417 },
      { n: 'Coastal walks', c: N, notes: '[activity] Cliff and harbor walks.' },
      { n: 'Hotel — Sidi Bou Said', c: H, notes: '[lodging] Base in Sidi Bou Said.' },
    ],
    [
      { n: 'Kerkouane', c: A, notes: '[activity] Cap Bon Punic city ruins.', lat: 36.9464, lng: 11.0986 },
      { n: 'Return Tunis', c: T, notes: '[transport] Return north.' },
    ],
    [
      { n: 'Dougga', c: A, notes: '[activity] Full day: theater, Capitol, forum, baths, residential quarter.', lat: 36.4233, lng: 9.2200 },
    ],
    [
      { n: 'El Jem Amphitheater', c: A, notes: '[activity] Amphitheater + underground chambers.', lat: 35.2964, lng: 10.7069 },
      { n: 'Continue to Kairouan', c: T, notes: '[transport] Onward to holy city.', lat: 35.6781, lng: 10.0963 },
    ],
    [
      { n: 'Great Mosque of Kairouan', c: A, notes: '[activity] Oldest mosque in the Maghreb.', lat: 35.6814, lng: 10.1036 },
      { n: 'Medina of Kairouan', c: S, notes: '[activity] Medina wander.' },
      { n: 'Aghlabid Basins', c: A, notes: '[activity] Historic water basins.' },
      { n: 'Barber’s Mosque', c: A, notes: '[activity] Zaouia of Sidi Sahab.' },
      { n: 'Continue to Tozeur', c: T, notes: '[transport] Southwest to oasis town.', lat: 33.9197, lng: 8.1335 },
      { n: 'Hotel — Tozeur', c: H, notes: '[lodging] Tozeur overnight.' },
    ],
    [
      { n: 'Tozeur Palm Oasis', c: N, notes: '[activity] Palmery walk.' },
      { n: 'Tozeur Old Medina', c: A, notes: '[activity] Brick-patterned old town.' },
      { n: 'Chott el Jerid', c: N, notes: '[activity] Salt flats.', lat: 33.7000, lng: 8.4000 },
      { n: 'Star Wars filming locations', c: X, notes: '[activity] Mos Espa / desert sets area.' },
    ],
    [
      { n: 'Matmata troglodyte houses', c: A, notes: '[activity] Berber pit houses.', lat: 33.5444, lng: 9.9667 },
      { n: 'Return toward Tunis', c: T, notes: '[transport] Long northbound transit.' },
      { n: 'Hotel — Tunis Airport area', c: H, notes: '[lodging] Pre-flight buffer near TUN.' },
    ],
    [{ n: 'Depart TUN', c: T, notes: '[transport] Fly home from Tunis.' }],
    [{ n: 'Arrive ORD', c: T, notes: '[transport] Land Chicago.' }],
  ],

  'Iceland & Norway: Ring Road to the Fjords': [
    [
      { n: 'Thingvellir National Park', c: N, notes: '[activity] Parliament ruins; ~45 min from KEF.', lat: 64.2559, lng: -21.1292 },
      { n: 'Silfra snorkel', c: X, notes: '[activity] ~$130; book Dive.is ~2 months ahead; 30–45°F water.' },
      { n: 'Brúarfoss', c: N, notes: '[activity] 1.2-mile RT hike, ~45 min.' },
      { n: 'Strokkur Geyser', c: N, notes: '[activity] Free; ~30 min.', lat: 64.3131, lng: -20.3025 },
      { n: 'Gullfoss', c: N, notes: '[activity] Free; ~45 min.', lat: 64.3271, lng: -20.1199 },
      { n: 'Kerið Crater', c: N, notes: '[activity] ~$5 entry; ~30 min.', lat: 64.0411, lng: -20.8853 },
      { n: 'Reykjadalur hot springs', c: X, notes: '[activity] 2.4-mile RT, ~1.5h; bring swimsuit.' },
      { n: 'Camp Selfoss', c: H, notes: '[lodging] Camp ~$20/night.' },
    ],
    [
      { n: 'Landeyjahöfn ferry → Heimaey', c: T, notes: '[transport] Ferry ~$30 RT, 45 min.' },
      { n: 'Eldfell volcano hike', c: N, notes: '[activity] 1.5-mile RT; 1973 eruption site.', lat: 63.4333, lng: -20.2500 },
      { n: 'Elephant Rock', c: N, notes: '[activity] Viewpoint ~30 min.' },
      { n: 'Eldheimar Volcano Museum', c: A, notes: '[activity] ~$15, ~1h.' },
      { n: 'Camp Vík', c: H, notes: '[lodging] Camp ~$20 after return ferry.' },
    ],
    [
      { n: 'Seljalandsfoss', c: N, notes: '[activity] Walk-behind falls.', lat: 63.6156, lng: -19.9886 },
      { n: 'Gljúfrabúi', c: N, notes: '[activity] Hidden canyon waterfall; short scramble.' },
      { n: 'Seljavallalaug pool', c: X, notes: '[activity] 1.2-mile RT to historic pool.' },
      { n: 'Skógafoss', c: N, notes: '[activity] Climb 370 steps for top view.', lat: 63.5321, lng: -19.5114 },
      { n: 'Kvernufoss', c: N, notes: '[activity] Canyon walk ~30 min.' },
      { n: 'Sólheimajökull glacier hike', c: X, notes: '[activity] Guided ~$80, 2–3h; Icelandic Mountain Guides.' },
      { n: 'Dyrhólaey', c: N, notes: '[activity] Arch viewpoint.' },
      { n: 'Reynisfjara', c: N, notes: '[activity] Basalt columns; stay 50ft from waves (sneaker waves).', lat: 63.4047, lng: -19.0603 },
      { n: 'Vík church', c: A, notes: '[activity] Brief stop.' },
      { n: 'Camp Vík / Skaftafell', c: H, notes: '[lodging] Camp ~$20–25.' },
    ],
    [
      { n: 'Eldhraun lava field', c: N, notes: '[activity] Drive through lava.' },
      { n: 'Fjaðrárgljúfur Canyon', c: N, notes: '[activity] 1-mile loop, ~45 min.', lat: 63.7711, lng: -18.1717 },
      { n: 'Dverghamrar', c: N, notes: '[activity] Basalt columns roadside.' },
      { n: 'Foss á Síðu', c: N, notes: '[activity] Roadside waterfall.' },
      { n: 'Svartifoss hike', c: N, notes: '[activity] 3-mile RT, ~2h; basalt waterfall.', lat: 64.0167, lng: -16.9833 },
      { n: 'Hofskirkja turf church', c: A, notes: '[activity] Turf church stop.' },
      { n: 'Múlagljúfur Canyon', c: N, notes: '[activity] Viewpoint canyon ~30 min.' },
      { n: 'Camp Skaftafell', c: H, notes: '[lodging] Camp ~$25.' },
    ],
    [
      { n: 'Fjallsárlón', c: N, notes: '[activity] Quieter glacier lagoon.', lat: 64.0167, lng: -16.3667 },
      { n: 'Jökulsárlón', c: N, notes: '[activity] Icebergs; optional boat ~$60.', lat: 64.0784, lng: -16.2306 },
      { n: 'Diamond Beach', c: N, notes: '[activity] Ice on black sand.' },
      { n: 'Stokksnes / Vestrahorn', c: N, notes: '[activity] ~$10 entry; sunrise key.', lat: 64.2442, lng: -14.9647 },
      { n: 'Camp Höfn', c: H, notes: '[lodging] Camp ~$20.' },
    ],
    [
      { n: 'East fjord lighthouse', c: N, notes: '[activity] Brief fjord stop.' },
      { n: 'Seyðisfjörður', c: A, notes: '[activity] Blue church / rainbow path; ~30 min off Ring Road.', lat: 65.2614, lng: -14.0089 },
      { n: 'Hengifoss hike', c: N, notes: '[activity] 3.5-mile RT, ~2.5h; Iceland’s 3rd highest falls.' },
      { n: 'Camp Egilsstaðir', c: H, notes: '[lodging] Camp ~$20.' },
    ],
    [
      { n: 'Dettifoss', c: N, notes: '[activity] Europe’s most powerful falls; boots for slippery paths.', lat: 65.8147, lng: -16.3844 },
      { n: 'Víti crater', c: N, notes: '[activity] ~$10, ~30 min.' },
      { n: 'Mývatn Nature Baths', c: X, notes: '[activity] ~$50; better value than Blue Lagoon.', lat: 65.6333, lng: -16.8167 },
      { n: 'Goðafoss', c: N, notes: '[activity] Waterfall of the Gods.', lat: 65.6828, lng: -17.5503 },
      { n: 'Camp Mývatn', c: H, notes: '[lodging] Camp ~$20.' },
    ],
    [
      { n: 'Húsavík whale watching', c: X, notes: '[activity] ~$100, ~3h; North Sailing reputable.', lat: 66.0449, lng: -17.3383 },
      { n: 'Akureyri', c: A, notes: '[activity] Town + botanical garden.', lat: 65.6826, lng: -18.0907 },
      { n: 'Hvítserkur', c: N, notes: '[activity] Rhino rock; 1-mile RT; watch tides.', lat: 65.6050, lng: -20.6050 },
      { n: 'Camp Blönduós', c: H, notes: '[lodging] Camp ~$20.' },
    ],
    [
      { n: 'Kirkjufell', c: N, notes: '[activity] Photo stop; optional 1h hike.', lat: 64.9281, lng: -23.3067 },
      { n: 'Búðakirkja black church', c: A, notes: '[activity] Black wooden church.' },
      { n: 'Gatklettur', c: N, notes: '[activity] 1-mile coastal walk.' },
      { n: 'Löndrangar', c: N, notes: '[activity] Volcanic plugs.' },
      { n: 'Camp Snæfellsnes', c: H, notes: '[lodging] Camp ~$20.' },
    ],
    [
      { n: 'Glymur hike', c: N, notes: '[activity] 3.5-mile RT; river crossing — bring dry bag.', lat: 64.3900, lng: -21.2500 },
      { n: 'Reykjavík walk', c: A, notes: '[activity] Sun Voyager, Hallgrímskirkja.', lat: 64.1466, lng: -21.9426 },
      { n: 'Blue Lagoon or Sky Lagoon', c: X, notes: '[activity] ~$60–100; sunset views.' },
      { n: 'Fly Reykjavík → Bergen', c: T, notes: '[transport] Short hop to Norway.', lat: 60.3913, lng: 5.3221 },
    ],
    [
      { n: 'Mt. Fløyen', c: N, notes: '[activity] Funicular / hike above Bergen.' },
      { n: 'Bryggen', c: A, notes: '[activity] Hanseatic wharf.', lat: 60.3973, lng: 5.3244 },
      { n: 'Bergen evening harbor', c: A, notes: '[activity] Harbor stroll.' },
    ],
    [
      { n: 'Norway in a Nutshell', c: T, notes: '[transport] Scenic rail/boat day.' },
      { n: 'Nærøyfjord', c: N, notes: '[activity] UNESCO fjord cruise segment.' },
      { n: 'Aurlandsfjord', c: N, notes: '[activity] Fjord views.' },
      { n: 'Flåm', c: A, notes: '[activity] Village stop.', lat: 60.8631, lng: 7.1139 },
    ],
    [
      { n: 'Stegastein Viewpoint', c: N, notes: '[activity] Cantilever viewpoint over Aurland.' },
      { n: 'Borgund Stave Church', c: A, notes: '[activity] Medieval stave church.', lat: 61.0472, lng: 7.8133 },
      { n: 'Lærdal', c: A, notes: '[activity] Valley town stop.' },
    ],
    [
      { n: 'Trollstigen (if open)', c: T, notes: '[transport] Mountain road if seasonal access allows.' },
      { n: 'Geirangerfjord', c: N, notes: '[activity] Classic fjord.', lat: 62.1015, lng: 7.2050 },
    ],
    [
      { n: 'Seven Sisters waterfall', c: N, notes: '[activity] Geiranger waterfall views.' },
      { n: 'Dalsnibba', c: N, notes: '[activity] High viewpoint above Geiranger.' },
      { n: 'Fly home', c: T, notes: '[transport] International departure home.' },
    ],
  ],

  'Central Europe: Prague to Budapest': [
    [{ n: 'ORD → PRG', c: T, notes: '[transport] Evening flight Chicago → Prague.' }],
    [
      { n: 'Arrive Prague', c: T, notes: '[transport] Settle in.', lat: 50.0755, lng: 14.4378 },
      { n: 'Old Town Square & Astronomical Clock', c: A, notes: '[activity] Orloj and square.', lat: 50.0870, lng: 14.4208 },
      { n: 'Chlebíčky or svíčková dinner', c: R, notes: '[food] Sisters for chlebíčky, or svíčková; Lokál Dlouhááá / U Kroka.' },
    ],
    [
      { n: 'Prague Castle (North Gate)', c: A, notes: '[activity] Enter North Gate; St. Vitus; Golden Lane.', lat: 50.0911, lng: 14.4016 },
      { n: 'Petřín Hill funicular', c: X, notes: '[activity] Panoramic views.' },
      { n: 'Malá Strana', c: A, notes: '[activity] Lesser Town lanes.' },
      { n: 'Trdelník snack', c: R, notes: '[food] Chimney cake walk-around snack.' },
      { n: 'Optional Lennon Wall / Letná sunset', c: A, notes: '[activity] If time allows.' },
      { n: 'Vltava River cruise', c: X, notes: '[activity] Evening cruise.' },
    ],
    [
      { n: 'Option: Jewish Quarter (Josefov)', c: A, notes: '[activity] Old Jewish Cemetery, Spanish Synagogue.' },
      { n: 'Option: National Museum + Vyšehrad', c: A, notes: '[activity] Quieter fortress alternative.' },
      { n: 'Option: Kutná Hora half-day', c: A, notes: '[activity] Sedlec Bone Church + St. Barbara’s.' },
      { n: 'Malá Strana cafés', c: C, notes: '[food] Relaxed afternoon; try smažený sýr.' },
      { n: 'Czech dinner + live music', c: R, notes: '[food] Traditional dinner evening.' },
    ],
    [
      { n: 'Train Prague → Salzburg', c: T, notes: '[transport] Early train ~6h.', lat: 47.8095, lng: 13.0550 },
      { n: 'Mirabell Palace & Gardens', c: A, notes: '[activity] Gardens and palace.' },
      { n: 'Mozart’s Birthplace', c: A, notes: '[activity] Getreidegasse museum.' },
      { n: 'Wiener schnitzel — Gasthof Goldgasse', c: R, notes: '[food] Traditional schnitzel; Getreidegasse stroll after.' },
    ],
    [
      { n: 'Hohensalzburg Fortress', c: A, notes: '[activity] Funicular up for unmatched views.', lat: 47.7950, lng: 13.0472 },
      { n: 'Transit to St. Wolfgang', c: T, notes: '[transport] Lakeside base.', lat: 47.7389, lng: 13.4486 },
      { n: 'Lake trout (Reinanke) dinner', c: R, notes: '[food] Lakeside restaurant; Kaiserschmarrn / Kasnocken.' },
      { n: 'Hotel — St. Wolfgang', c: H, notes: '[lodging] Lakeside overnight.' },
    ],
    [
      { n: 'Hallstatt day trip', c: A, notes: '[activity] Early bus/ferry; salt mine or Five Fingers viewpoint.', lat: 47.5622, lng: 13.6493 },
      { n: 'Return St. Wolfgang afternoon', c: X, notes: '[activity] Quiet family afternoon lakeside.' },
    ],
    [
      { n: 'Transit to Vienna', c: T, notes: '[transport] Bus then train.', lat: 48.2082, lng: 16.3738 },
      { n: 'Schönbrunn Palace', c: A, notes: '[activity] Book entry 4+ weeks ahead.', lat: 48.1858, lng: 16.3128 },
      { n: 'Café Sacher', c: C, notes: '[food] Apfelstrudel or Sachertorte.' },
    ],
    [
      { n: 'Kunsthistorisches or Imperial Crypt', c: A, notes: '[activity] Pick one major morning site.' },
      { n: 'Viennese coffeehouse + City Park', c: C, notes: '[activity] Classic coffee break.' },
      { n: 'St. Stephen’s / Hofburg / National Library', c: A, notes: '[activity] Optional city highlights.' },
      { n: 'Tafelspitz dinner', c: R, notes: '[food] Boiled beef in broth.' },
    ],
    [
      { n: 'Train Vienna → Budapest', c: T, notes: '[transport] Early train.', lat: 47.4979, lng: 19.0402 },
      { n: 'St. Stephen’s Basilica', c: A, notes: '[activity] Pest side.', lat: 47.5009, lng: 19.0542 },
      { n: 'Parliament building', c: A, notes: '[activity] Exterior / plaza.', lat: 47.5072, lng: 19.0456 },
      { n: 'Jewish Quarter', c: A, notes: '[activity] Pest Jewish Quarter wander.' },
      { n: 'Retró Lángos', c: R, notes: '[food] Garlic/sour cream/cheese lángos.' },
      { n: 'Danube sunset cruise', c: X, notes: '[activity] Illuminated city; Shoes on the Danube at sunset.' },
    ],
    [
      { n: 'Fisherman’s Bastion (early)', c: A, notes: '[activity] Before 9 AM / sunrise for empty terraces.', lat: 47.5022, lng: 19.0347 },
      { n: 'Buda Castle', c: A, notes: '[activity] Castle hill.', lat: 47.4964, lng: 19.0396 },
      { n: 'Hospital in the Rock', c: A, notes: '[activity] Unique underground hospital museum.' },
      { n: 'Jewish Quarter evening', c: A, notes: '[activity] Evening explore.' },
      { n: 'Paprikás csirke', c: R, notes: '[food] Chicken paprikash dinner.' },
    ],
    [
      { n: 'Hungarian National Museum or Great Market Hall', c: A, notes: '[activity] Last souvenirs; túró rudi snack.' },
      { n: '100E Airport Express → BUD', c: T, notes: '[transport] Airport bus to BUD.' },
    ],
  ],

  'Portugal: Lisbon, Évora & Porto': [
    [
      { n: 'Arrive Lisbon (morning)', c: T, notes: '[transport] Overnight ORD → LIS; morning arrival.', lat: 38.7223, lng: -9.1393 },
      { n: 'Hotel — Baixa / Chiado', c: H, notes: '[lodging] Base in Baixa or Chiado.' },
      { n: 'Praça do Comércio', c: A, notes: '[activity] Waterfront square.', lat: 38.7075, lng: -9.1364 },
      { n: 'Rua Augusta', c: A, notes: '[activity] Pedestrian avenue.' },
      { n: 'Santa Justa Lift', c: A, notes: '[activity] Iron elevator viewpoint.' },
      { n: 'Bacalhau dinner', c: R, notes: '[food] Bacalhau / pastéis de bacalhau.' },
      { n: 'Pastéis de Belém dessert', c: C, notes: '[food] Classic custard tarts (Belém or city).' },
    ],
    [
      { n: 'Lisbon Cathedral', c: A, notes: '[activity] Sé.', lat: 38.7098, lng: -9.1330 },
      { n: 'Castelo de São Jorge', c: A, notes: '[activity] Hilltop castle.', lat: 38.7139, lng: -9.1334 },
      { n: 'Alfama & miradouros', c: A, notes: '[activity] Historic lanes and viewpoints.' },
      { n: 'Cervejaria Ramiro', c: R, notes: '[food] Seafood lunch.' },
      { n: 'National Tile Museum', c: A, notes: '[activity] Azulejo museum.', lat: 38.7247, lng: -9.1053 },
      { n: 'Tram 28', c: T, notes: '[transport] Classic tram ride.' },
      { n: 'Fado dinner', c: R, notes: '[food] Traditional fado evening.' },
    ],
    [
      { n: 'Jerónimos Monastery', c: A, notes: '[activity] Belém Manueline masterpiece.', lat: 38.6978, lng: -9.2064 },
      { n: 'Monument to the Discoveries', c: A, notes: '[activity] Padrão dos Descobrimentos.' },
      { n: 'Belém Tower', c: A, notes: '[activity] Riverside tower.', lat: 38.6916, lng: -9.2160 },
      { n: 'Optional MAAT', c: A, notes: '[activity] Contemporary art/architecture.' },
      { n: 'Pastéis de Belém lunch', c: C, notes: '[food] Original bakery.' },
      { n: 'LX Factory', c: A, notes: '[activity] Afternoon creative complex.' },
    ],
    [
      { n: 'Sintra day trip', c: T, notes: '[transport] Leave early.', lat: 38.8029, lng: -9.3817 },
      { n: 'Pena Palace', c: A, notes: '[activity] Colorful hilltop palace.' },
      { n: 'Moorish Castle', c: A, notes: '[activity] Ramparts above Sintra.' },
      { n: 'Sintra historic center', c: A, notes: '[activity] Town center.' },
      { n: 'Quinta da Regaleira', c: A, notes: '[activity] Initiation well and gardens.' },
    ],
    [
      { n: 'Lisbon → Évora', c: T, notes: '[transport] Drive or train ~1.5h.', lat: 38.5714, lng: -7.9135 },
      { n: 'Roman Temple of Évora', c: A, notes: '[activity] Temple of Diana.' },
      { n: 'Évora Cathedral', c: A, notes: '[activity] Hilltop cathedral.' },
      { n: 'Bone Chapel', c: A, notes: '[activity] Capela dos Ossos.' },
      { n: 'Évora historic center', c: A, notes: '[activity] Walled center wander.' },
      { n: 'Alentejo dinner', c: R, notes: '[food] Regional Alentejo food.' },
      { n: 'Hotel — Évora historic center', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Almendres Cromlech', c: A, notes: '[activity] Megalithic stone circle.', lat: 38.5578, lng: -8.0611 },
      { n: 'Dolmen sites', c: A, notes: '[activity] Nearby megaliths.' },
      { n: 'Roman ruins nearby', c: A, notes: '[activity] Optional Roman stops.' },
    ],
    [
      { n: 'Train to Porto', c: T, notes: '[transport] North to Porto.', lat: 41.1579, lng: -8.6291 },
      { n: 'Ribeira', c: A, notes: '[activity] Riverside old town.', lat: 41.1406, lng: -8.6120 },
      { n: 'Dom Luís Bridge', c: A, notes: '[activity] Iconic bridge views.' },
      { n: 'Port wine cellar', c: C, notes: '[food] Gaia cellar tasting.' },
      { n: 'Livraria Lello', c: A, notes: '[activity] Famous bookstore.' },
      { n: 'São Bento Station', c: A, notes: '[activity] Azulejo station hall.' },
      { n: 'Porto Cathedral', c: A, notes: '[activity] Sé do Porto.' },
      { n: 'Church of São Francisco', c: A, notes: '[activity] Gilded Baroque interior.' },
      { n: 'Hotel — Ribeira', c: H, notes: '[lodging] Ribeira neighborhood.' },
    ],
    [
      { n: 'Douro Valley day trip', c: X, notes: '[activity] Wine estates, boat cruise, scenery.', lat: 41.1500, lng: -7.7833 },
    ],
    [
      { n: 'Porto open exploring', c: A, notes: '[activity] Free day in Ribeira / city.' },
    ],
    [
      { n: 'Braga Cathedral', c: A, notes: '[activity] Base in Braga.', lat: 41.5503, lng: -8.4200 },
      { n: 'Bom Jesus do Monte', c: A, notes: '[activity] Stairway sanctuary.', lat: 41.5547, lng: -8.3772 },
      { n: 'Hotel — Braga', c: H, notes: '[lodging] Braga base.' },
    ],
    [
      { n: 'Guimarães Castle', c: A, notes: '[activity] Birthplace of Portugal castle.', lat: 41.4475, lng: -8.2900 },
      { n: 'Palace of the Dukes', c: A, notes: '[activity] Ducal palace.' },
      { n: 'Guimarães historic center', c: A, notes: '[activity] UNESCO old town.' },
      { n: 'Optional Citânia de Briteiros', c: A, notes: '[activity] Iron Age Celtic settlement.' },
    ],
    [
      { n: 'Return Porto → fly home', c: T, notes: '[transport] Porto → Chicago.' },
    ],
  ],

  'Guatemala: Antigua, Acatenango & Atitlán': [
    [
      { n: 'ORD → GUA', c: T, notes: '[transport] Arrive mid-day if possible.', lat: 14.5833, lng: -90.5272 },
      { n: 'Shuttle GUA → Antigua', c: T, notes: '[transport] ~45 min, ~$25 shared van.', lat: 14.5586, lng: -90.7295 },
      { n: 'Antigua walking tour', c: X, notes: '[activity] 2–4 PM; plazas, La Merced, Santa Catalina Arch; tip ~$10.' },
      { n: 'Dinner Antigua', c: R, notes: '[food] ~$15–20.' },
    ],
    [
      { n: 'Optional coffee plantation tour', c: X, notes: '[activity] 8 AM–12 PM; ~$25.' },
      { n: 'Museo Casa Santo Domingo / markets', c: A, notes: '[activity] Free time; museum ~$12.' },
      { n: 'Acatenango gear check', c: O, notes: '[activity] 4 PM packs, layers, headlamps; early dinner; rest.' },
    ],
    [
      { n: 'Acatenango trailhead pickup', c: T, notes: '[transport] 5 AM hotel pickup; 1h to La Soledad.' },
      { n: 'Acatenango ascent', c: X, notes: '[activity] 3–4 mi, 4–6h, ~3,000 ft gain; basecamp ~12,300 ft by 2 PM. Tour ~$120.', lat: 14.5006, lng: -90.8756 },
      { n: 'Fuego viewpoint from basecamp', c: N, notes: '[activity] Eruption views ~4 PM.' },
    ],
    [
      { n: 'Acatenango sunrise summit', c: X, notes: '[activity] 4:30 AM peak push; descend 4–5h; Antigua ~1 PM.' },
      { n: 'Recovery afternoon Antigua', c: X, notes: '[activity] Rest; dinner ~$15.' },
    ],
    [
      { n: 'Shuttle Antigua → Panajachel', c: T, notes: '[transport] 8 AM; 2.5h, ~$25.', lat: 14.7419, lng: -91.1567 },
      { n: 'Lake Atitlán village boat tour', c: X, notes: '[activity] 11 AM; San Juan / Santiago; 3–4h incl lunch ~$20.' },
      { n: 'Hotel Atitlán', c: H, notes: '[lodging] ~$130 pp/night; lakeside evening optional.' },
    ],
    [
      { n: 'Option A: Indian Nose + GUA flight', c: X, notes: '[activity] 7 AM boat to San Pedro + mini-hike; 11 AM shuttle to GUA (4h, $35); late flight.' },
      { n: 'Option B: relaxed Atitlán day', c: X, notes: '[activity] Markets/kayak (~$20); next-day departure.' },
    ],
  ],

  'Canadian Rockies: Banff to Jasper': [
    [
      { n: 'Chicago → Calgary', c: T, notes: '[transport] Fly YYC; collect rental.', lat: 51.0447, lng: -114.0719 },
      { n: 'Drive to Banff', c: T, notes: '[transport] ~1.5–2h.', lat: 51.1784, lng: -115.5708 },
      { n: 'Banff Avenue', c: A, notes: '[activity] Town stroll.' },
      { n: 'Bow Falls & Surprise Corner', c: N, notes: '[activity] Classic Banff viewpoints.' },
      { n: 'Vermilion Lakes sunset', c: N, notes: '[activity] If timing allows.', lat: 51.1833, lng: -115.5833 },
      { n: 'Hotel — Banff', c: H, notes: '[lodging] Overnight Banff.' },
    ],
    [
      { n: 'Johnston Canyon Upper Falls', c: N, notes: '[activity] 8 AM start; 5–6 km RT.', lat: 51.2458, lng: -115.8397 },
      { n: 'Lake Minnewanka', c: N, notes: '[activity] Late morning lake stop.', lat: 51.2500, lng: -115.4833 },
      { n: 'Two Jack Lake', c: N, notes: '[activity] Nearby scenic lake.' },
      { n: 'Banff Gondola / Sulphur Mountain', c: X, notes: '[activity] Ride or hike.' },
      { n: 'Dinner Banff', c: R, notes: '[food] Town dinner.' },
    ],
    [
      { n: 'Drive Banff → Lake Louise', c: T, notes: '[transport] ~45 min; reserved shuttle.', lat: 51.4254, lng: -116.1773 },
      { n: 'Lake Louise shoreline', c: N, notes: '[activity] Victoria Glacier views.' },
      { n: 'Lake Agnes Tea House hike', c: N, notes: '[activity] Main hike 4–5.5h; optional Big Beehive.' },
      { n: 'Hotel — Lake Louise / Field BC', c: H, notes: '[lodging] Overnight Lake Louise area.' },
    ],
    [
      { n: 'Moraine Lake (shuttle)', c: N, notes: '[activity] Reserved shuttle; Rockpile trail.', lat: 51.3217, lng: -116.1861 },
      { n: 'Emerald Lake (Yoho)', c: N, notes: '[activity] Afternoon west into Yoho.', lat: 51.4436, lng: -116.5297 },
      { n: 'Takakkaw Falls', c: N, notes: '[activity] Tall waterfall stop.', lat: 51.4950, lng: -116.4730 },
    ],
    [
      { n: 'Icefields Parkway', c: T, notes: '[transport] ~232 km / 9–11h adventure with stops to Jasper.', lat: 52.8737, lng: -118.0814 },
      { n: 'Hotel — Jasper', c: H, notes: '[lodging] Overnight Jasper.' },
    ],
    [
      { n: 'Medicine Lake', c: N, notes: '[activity] Stop en route to Maligne.', lat: 52.8500, lng: -117.7667 },
      { n: 'Maligne Lake boat — Spirit Island', c: X, notes: '[activity] Midday cruise to Spirit Island.', lat: 52.7333, lng: -117.6333 },
      { n: 'Pyramid Lake & Patricia Lake', c: N, notes: '[activity] Late afternoon lakes.', lat: 52.9167, lng: -118.1000 },
      { n: 'Jasper dinner / stargazing', c: R, notes: '[food] Dinner; optional stargazing.' },
    ],
    [
      { n: 'Drive Jasper → YEG', c: T, notes: '[transport] ~4.5–5h to Edmonton airport; return car; fly ORD.' },
    ],
  ],

  'Northern China: Beijing to Xi\'an': [
    [{ n: 'ORD → PEK/PKX', c: T, notes: '[transport] ~14–15h direct to Beijing.' }],
    [
      { n: 'Land Beijing ~2:30 PM', c: T, notes: '[transport] AREX to city center.', lat: 39.9042, lng: 116.4074 },
      { n: 'Qianmen pedestrian street', c: A, notes: '[activity] Welcome walk.' },
      { n: 'Peking Duck dinner', c: R, notes: '[food] Authentic welcome ~$35.' },
      { n: 'Hotel — Dongcheng', c: H, notes: '[lodging] Dongcheng District.' },
    ],
    [
      { n: 'Forbidden City', c: A, notes: '[activity] Massive halls of the imperial palace.', lat: 39.9163, lng: 116.3972 },
      { n: 'Jingshan Park', c: N, notes: '[activity] Panorama over imperial roofs.', lat: 39.9236, lng: 116.3969 },
    ],
    [
      { n: 'Mutianyu Great Wall', c: A, notes: '[activity] Early rugged wall section.', lat: 40.4319, lng: 116.5704 },
      { n: 'Summer Palace', c: A, notes: '[activity] Lakeside pavilions afternoon.', lat: 39.9990, lng: 116.2755 },
    ],
    [
      { n: 'Temple of Heaven', c: A, notes: '[activity] Circular imperial architecture.', lat: 39.8822, lng: 116.4066 },
      { n: 'National Museum of China', c: A, notes: '[activity] Grand imperial collections.', lat: 39.9053, lng: 116.4014 },
    ],
    [
      { n: 'Hutongs — Bell & Drum Towers', c: A, notes: '[activity] Ancient brick alleyways.', lat: 39.9400, lng: 116.3900 },
      { n: 'Lama Temple', c: A, notes: '[activity] Tibetan Buddhist temple.', lat: 39.9450, lng: 116.4175 },
    ],
    [
      { n: 'Bullet train → Datong', c: T, notes: '[transport] 8:00 AM; ~2h.', lat: 40.0768, lng: 113.3001 },
      { n: 'Yungang Grottoes', c: A, notes: '[activity] 51,000+ Buddhist cliff statues ~$17.', lat: 40.1100, lng: 113.1250 },
      { n: 'Hotel — Datong Old Town', c: H, notes: '[lodging] Old Town base.' },
    ],
    [
      { n: 'Hanging Temple (Xuankong Si)', c: A, notes: '[activity] Cliffside temple ~1,500 years.', lat: 39.6667, lng: 113.6167 },
      { n: 'Datong Old City Walls', c: A, notes: '[activity] Afternoon wall walk.' },
    ],
    [
      { n: 'Bullet train → Pingyao', c: T, notes: '[transport] Morning ~2.5h.', lat: 37.2047, lng: 112.1772 },
      { n: 'Pingyao ancient city', c: A, notes: '[activity] Vehicle-free Ming/Qing streets.' },
      { n: 'Hotel — Courtyard Han Inn', c: H, notes: '[lodging] Courtyard inn.' },
    ],
    [
      { n: 'Rishengchang Draft Bank', c: A, notes: '[activity] China’s first prototype bank vaults.' },
      { n: 'Pingyao Yamen', c: A, notes: '[activity] Ancient county government compound.' },
    ],
    [
      { n: 'HSR → Luoyang', c: T, notes: '[transport] ~2h into Henan.', lat: 34.6197, lng: 112.4539 },
      { n: 'Longmen Grottoes', c: A, notes: '[activity] Cliff Buddhas on the Yi River.', lat: 34.5556, lng: 112.4689 },
      { n: 'Hotel — Luoyang Center', c: H, notes: '[lodging] City center.' },
    ],
    [
      { n: 'Rail → Kaifeng', c: T, notes: '[transport] ~1h regional link.', lat: 34.7970, lng: 114.3074 },
      { n: 'Millennium City Park', c: A, notes: '[activity] Living reconstruction of ancient scroll.' },
      { n: 'Iron Pagoda', c: A, notes: '[activity] Historic pagoda.' },
      { n: 'Return Luoyang', c: T, notes: '[transport] Evening return.' },
    ],
    [
      { n: 'White Horse Temple', c: A, notes: '[activity] Traditionally first Buddhist temple in China.', lat: 34.7236, lng: 112.5997 },
      { n: 'Luoyang Museum', c: A, notes: '[activity] Tang sancai ceramics.' },
    ],
    [
      { n: 'HSR → Xi\'an', c: T, notes: '[transport] ~1.5h.', lat: 34.3416, lng: 108.9398 },
      { n: 'Muslim Quarter food crawl', c: R, notes: '[food] Yangrou paomo ~$15.' },
      { n: 'Hotel — Xi\'an City Center', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Terracotta Army', c: A, notes: '[activity] Excavation pits ~$16.', lat: 34.3849, lng: 109.2734 },
      { n: 'Xi\'an City Wall', c: A, notes: '[activity] Cycle/walk ~$8.', lat: 34.2658, lng: 108.9541 },
    ],
    [
      { n: 'Big Wild Goose Pagoda', c: A, notes: '[activity] Silk Road scripture pagoda.', lat: 34.2186, lng: 108.9642 },
      { n: 'Shaanxi History Museum', c: A, notes: '[activity] Imperial gold and bronze galleries.', lat: 34.2250, lng: 108.9517 },
    ],
    [
      { n: 'Mount Huashan day trip', c: N, notes: '[activity] Cable car or hike granite cliffs.', lat: 34.4833, lng: 110.0833 },
    ],
    [
      { n: 'Hanyangling Tomb', c: A, notes: '[activity] Han Dynasty underground miniature figures.', lat: 34.4333, lng: 108.9417 },
      { n: 'Great Mosque of Xi\'an', c: A, notes: '[activity] Historic mosque in the Muslim Quarter.', lat: 34.2633, lng: 108.9425 },
    ],
    [
      { n: 'Xi\'an buffer day', c: X, notes: '[activity] Neighborhoods, tea, culinary markets.' },
    ],
    [{ n: 'Depart XIY', c: T, notes: '[transport] Connection via Beijing or Shanghai.' }],
    [{ n: 'Arrive ORD', c: T, notes: '[transport] Same calendar day.' }],
  ],

  'Silk Road: Xi\'an to Kashgar': [
    [{ n: 'ORD → XIY', c: T, notes: '[transport] Long-haul via Taipei or Seoul.' }],
    [
      { n: 'Arrive Xi\'an', c: T, notes: '[transport] Land XIY.', lat: 34.3416, lng: 108.9398 },
      { n: 'Bell & Drum Towers (illuminated)', c: A, notes: '[activity] Evening towers.', lat: 34.2610, lng: 108.9420 },
      { n: 'Biang biang noodles', c: R, notes: '[food] Welcome hand-pulled noodles.' },
      { n: 'Hotel — Xi\'an Center', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Terracotta Warriors', c: A, notes: '[activity] Excavation site.', lat: 34.3849, lng: 109.2734 },
      { n: 'Xi\'an City Wall', c: A, notes: '[activity] Walk/bike the wall.', lat: 34.2658, lng: 108.9541 },
    ],
    [
      { n: 'Big Wild Goose Pagoda', c: A, notes: '[activity] Pagoda visit.', lat: 34.2186, lng: 108.9642 },
      { n: 'Shaanxi History Museum', c: A, notes: '[activity] Historical context.' },
    ],
    [
      { n: 'HSR → Lanzhou', c: T, notes: '[transport] Morning ~3h.', lat: 36.0611, lng: 103.8343 },
      { n: 'Yellow River Waterwheel Park', c: A, notes: '[activity] Riverbank park.' },
      { n: 'Zhongshan Iron Bridge', c: A, notes: '[activity] Historic bridge crossing.' },
      { n: 'Lanzhou beef noodles', c: R, notes: '[food] Authentic hand-pulled noodles.' },
      { n: 'Hotel — Lanzhou Center', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Bingling Temple Caves', c: A, notes: '[activity] Boat across Liujiaxia Reservoir to cliff caves.', lat: 35.8333, lng: 103.0500 },
    ],
    [
      { n: 'Bullet → Zhangye', c: T, notes: '[transport] Hexi Corridor ~3h.', lat: 38.9249, lng: 100.4498 },
      { n: 'Dafo (Grand Buddha) Temple', c: A, notes: '[activity] Largest surviving indoor wooden reclining Buddha (1098).' },
      { n: 'Hotel — Zhangye Center', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Zhangye Danxia Geopark', c: N, notes: '[activity] Rainbow Mountains early.', lat: 38.9150, lng: 100.1330 },
      { n: 'Binggou Danxia', c: N, notes: '[activity] Red mudstone canyon hike.' },
    ],
    [
      { n: 'Bullet → Jiayuguan', c: T, notes: '[transport] ~2h west.', lat: 39.7720, lng: 98.2894 },
      { n: 'Jiayuguan Pass', c: A, notes: '[activity] Western terminus of Ming Great Wall.', lat: 39.8000, lng: 98.2167 },
      { n: 'Overhanging Great Wall', c: A, notes: '[activity] Gobi views from the wall spur.' },
    ],
    [
      { n: 'Express → Dunhuang', c: T, notes: '[transport] Morning train.', lat: 40.1421, lng: 94.6619 },
      { n: 'Singing Sand Dunes + Crescent Lake', c: N, notes: '[activity] Late afternoon ridge walk; sunset ~$15.', lat: 40.0920, lng: 94.6690 },
      { n: 'Hotel — Dunhuang Silk Road Resort', c: H, notes: '[lodging] Resort stay.' },
    ],
    [
      { n: 'Mogao Caves', c: A, notes: '[activity] Morning Buddhist murals/grottoes.', lat: 40.0411, lng: 94.8092 },
      { n: 'Dunhuang Night Market', c: S, notes: '[food] Regional skewers evening.' },
    ],
    [
      { n: 'Yumen Pass (Jade Gate)', c: A, notes: '[activity] Ancient mud-tamped ruins.', lat: 40.3500, lng: 93.8667 },
      { n: 'Yadan National Geological Park', c: N, notes: '[activity] Wind-carved yardangs.' },
    ],
    [
      { n: 'Bullet → Turpan', c: T, notes: '[transport] ~3.5h into Xinjiang.', lat: 42.9513, lng: 89.1895 },
      { n: 'Karez irrigation system', c: A, notes: '[activity] 2,000-year underground canals ~$5.' },
      { n: 'Jiaohe Ancient City', c: A, notes: '[activity] Cliffside mud ruins.', lat: 42.9500, lng: 89.0667 },
      { n: 'Hotel — Turpan Silk Road Lodge', c: H, notes: '[lodging] Lodge stay.' },
    ],
    [
      { n: 'Flaming Mountains', c: N, notes: '[activity] Heat-striated red sandstone.', lat: 42.9000, lng: 89.5000 },
      { n: 'Emin Minaret', c: A, notes: '[activity] Afghan-style brick minaret.', lat: 42.9833, lng: 89.1833 },
    ],
    [
      { n: 'To Urumqi + flight Kashgar', c: T, notes: '[transport] HSR then short flight to Kashgar.', lat: 39.4704, lng: 75.9898 },
      { n: 'Kashgar Old City', c: A, notes: '[activity] Clay-brick labyrinth.' },
      { n: 'Hotel — Kashgar Old Town Inn', c: H, notes: '[lodging] Old Town inn.' },
    ],
    [
      { n: 'Kashgar Livestock Market (if Sunday)', c: S, notes: '[activity] Centuries-old animal market.' },
      { n: 'Main Bazaar', c: S, notes: '[activity] Silk, spices, copperware.' },
    ],
    [
      { n: 'Id Kah Mosque', c: A, notes: '[activity] Largest mosque in Xinjiang.', lat: 39.4722, lng: 75.9836 },
      { n: 'Afaq Khoja Mausoleum', c: A, notes: '[activity] 17th-c mausoleum.' },
    ],
    [
      { n: 'Karakoram Highway day trip', c: X, notes: '[activity] Bulunkul + Karakul Lakes; Pamir glaciers; return Kashgar.', lat: 38.4333, lng: 75.0500 },
    ],
    [
      { n: 'Kashgar buffer day', c: X, notes: '[activity] Teahouses, mutton skewers, meat pies.' },
    ],
    [{ n: 'Depart KHG', c: T, notes: '[transport] Multi-leg eastbound.' }],
    [{ n: 'Arrive ORD', c: T, notes: '[transport] After date line.' }],
  ],

  'Southwest China: Chengdu to Shangri-La': [
    [{ n: 'ORD → TFU', c: T, notes: '[transport] Toward Southwest China via Taipei/Seoul.' }],
    [
      { n: 'Arrive Chengdu', c: T, notes: '[transport] Land TFU/CTU.', lat: 30.5728, lng: 104.0668 },
      { n: 'People’s Park teahouses', c: C, notes: '[activity] Bamboo groves and traditional teahouses.', lat: 30.6600, lng: 104.0550 },
      { n: 'Sichuan hotpot dinner', c: R, notes: '[food] Fiery welcome hotpot.' },
      { n: 'Hotel — Wuhou District', c: H, notes: '[lodging] Wuhou base.' },
    ],
    [
      { n: 'Giant Panda Breeding Base', c: N, notes: '[activity] Early morning to beat crowds.', lat: 30.7333, lng: 104.1450 },
      { n: 'Kuanzhai Alleys', c: A, notes: '[activity] Wide & Narrow Alleys.', lat: 30.6697, lng: 104.0500 },
    ],
    [
      { n: 'HSR → Leshan Giant Buddha', c: A, notes: '[activity] 1h train; 233-ft Tang cliff Buddha ~$16; return Chengdu.', lat: 29.5447, lng: 103.7703 },
    ],
    [
      { n: 'Wuhou Shrine', c: A, notes: '[activity] Three Kingdoms history.', lat: 30.6447, lng: 104.0475 },
      { n: 'Du Fu Thatched Cottage', c: N, notes: '[activity] Poet’s parklands.', lat: 30.6603, lng: 104.0289 },
    ],
    [
      { n: 'Bullet → Chongqing', c: T, notes: '[transport] ~1.5h.', lat: 29.5630, lng: 106.5516 },
      { n: 'Liziba monorail', c: X, notes: '[activity] Train through apartment building.' },
      { n: 'Hongyadong', c: A, notes: '[activity] Neon cliffside markets over Jialing River.', lat: 29.5639, lng: 106.5750 },
      { n: 'Hotel — Jiefangbei', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Dazu Rock Carvings', c: A, notes: '[activity] UNESCO 9th-c cliff statues day trip.', lat: 29.7167, lng: 105.7167 },
    ],
    [
      { n: 'Yangtze River Cable Car', c: X, notes: '[activity] Skyline panorama.' },
      { n: 'Ciqikou Ancient Town', c: A, notes: '[activity] Old wooden alleys.', lat: 29.5833, lng: 106.4500 },
    ],
    [
      { n: 'HSR → Kunming', c: T, notes: '[transport] ~4.5h south to Yunnan.', lat: 25.0389, lng: 102.7183 },
      { n: 'Green Lake Park', c: N, notes: '[activity] Local musicians.', lat: 25.0500, lng: 102.7000 },
      { n: 'Crossing the Bridge Noodles', c: R, notes: '[food] Yunnan specialty.' },
      { n: 'Hotel — Kunming Center', c: H, notes: '[lodging] Center base.' },
    ],
    [
      { n: 'Naigu Stone Forest', c: N, notes: '[activity] Karst pillar labyrinth.', lat: 24.8167, lng: 103.3167 },
    ],
    [
      { n: 'Bullet → Dali', c: T, notes: '[transport] ~2h; Nanzhao capital.', lat: 25.6065, lng: 100.2676 },
      { n: 'Dali Old Town', c: A, notes: '[activity] Stone gateways and lanes.' },
      { n: 'Hotel — Old Town courtyard inn', c: H, notes: '[lodging] Traditional courtyard.' },
    ],
    [
      { n: 'Erhai Lake loop', c: X, notes: '[activity] E-scooter/bike shoreline.', lat: 25.7667, lng: 100.1833 },
      { n: 'Xizhou Bai village', c: A, notes: '[activity] Tie-dye and Bai architecture.' },
    ],
    [
      { n: 'Cangshan Mountains cable car', c: N, notes: '[activity] Cloud Traveler’s Path.', lat: 25.6500, lng: 100.1500 },
      { n: 'Three Pagodas of Chongsheng', c: A, notes: '[activity] Views of iconic pagodas.', lat: 25.7086, lng: 100.1450 },
    ],
    [
      { n: 'Train → Lijiang', c: T, notes: '[transport] ~2h regional.', lat: 26.8721, lng: 100.2299 },
      { n: 'Lijiang Old Town (Dayan)', c: A, notes: '[activity] Canal labyrinth.' },
      { n: 'Black Dragon Pool', c: N, notes: '[activity] Mountain framed over water.', lat: 26.8867, lng: 100.2333 },
      { n: 'Hotel — Naxi guesthouse', c: H, notes: '[lodging] Traditional Naxi stay.' },
    ],
    [
      { n: 'Jade Dragon Snow Mountain', c: N, notes: '[activity] Alpine base.', lat: 27.1000, lng: 100.2000 },
      { n: 'Blue Moon Valley', c: N, notes: '[activity] Turquoise glacier waters ~$35.' },
    ],
    [
      { n: 'Baisha Village & Murals', c: A, notes: '[activity] 14th-c Tibetan/Han/Naxi murals; quiet farming village.', lat: 26.9667, lng: 100.2167 },
    ],
    [
      { n: 'Coach → Shangri-La', c: T, notes: '[transport] Scenic climb to ~10,000 ft.', lat: 27.8250, lng: 99.7060 },
      { n: 'Dukezong Old Town', c: A, notes: '[activity] Acclimate; giant gold prayer wheel.' },
      { n: 'Hotel — Tibetan-style inn', c: H, notes: '[lodging] First afternoon easy; hydrate.' },
    ],
    [
      { n: 'Ganden Sumtseling (Songzanlin)', c: A, notes: '[activity] “Little Potala” ~$13.', lat: 27.9000, lng: 99.7000 },
    ],
    [
      { n: 'Pudacuo National Park', c: N, notes: '[activity] Alpine lakes, wetlands, yaks.', lat: 27.8500, lng: 99.9500 },
      { n: 'Tibetan yak hotpot farewell', c: R, notes: '[food] Farewell dinner.' },
    ],
    [{ n: 'Depart DIG', c: T, notes: '[transport] Diqing Shangri-La Airport multi-leg home.' }],
    [{ n: 'Arrive ORD', c: T, notes: '[transport] Same calendar day.' }],
  ],
})

function main() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const RENAME = {
    'Greece & the Balkans': 'Greece & the Balkans: Athens to Sarajevo',
    'Morocco & Tunisia': 'Morocco & Tunisia: Sahara to Carthage',
    'Iceland Ring Road & Norway Fjords': 'Iceland & Norway: Ring Road to the Fjords',
  }
  const renameTrip = db.prepare('UPDATE trips SET title = ? WHERE user_id = 2 AND title = ?')
  for (const [oldTitle, newTitle] of Object.entries(RENAME)) {
    const r = renameTrip.run(newTitle, oldTitle)
    if (r.changes) console.log(`RENAMED "${oldTitle}" → "${newTitle}"`)
  }

  const tripRows = db.prepare(
    `SELECT id, title FROM trips WHERE user_id = 2 AND title IN (${Object.keys(TRIPS).map(() => '?').join(',')})`
  ).all(...Object.keys(TRIPS))

  const byTitle = Object.fromEntries(tripRows.map((t) => [t.title, t.id]))
  const missing = Object.keys(TRIPS).filter((t) => !byTitle[t])
  if (missing.length) {
    console.error('Missing trips in DB:', missing)
    process.exit(1)
  }

  const daysStmt = db.prepare('SELECT id, day_number FROM days WHERE trip_id = ? ORDER BY day_number')
  const delAssign = db.prepare(
    `DELETE FROM day_assignments WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?)`
  )
  const delPlaces = db.prepare('DELETE FROM places WHERE trip_id = ?')
  const insertPlace = db.prepare(`
    INSERT INTO places (trip_id, name, lat, lng, category_id, notes, duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, 60)
  `)
  const insertAssign = db.prepare(`
    INSERT INTO day_assignments (day_id, place_id, order_index) VALUES (?, ?, ?)
  `)

  const seedTrip = db.transaction((title, tripId, dayStops) => {
    delAssign.run(tripId)
    delPlaces.run(tripId)
    const days = daysStmt.all(tripId)
    if (days.length !== dayStops.length) {
      throw new Error(`${title}: DB has ${days.length} days, seed has ${dayStops.length}`)
    }
    let places = 0
    dayStops.forEach((stops, i) => {
      const dayId = days[i].id
      stops.forEach((s, j) => {
        const r = insertPlace.run(
          tripId,
          s.n,
          s.lat ?? null,
          s.lng ?? null,
          s.c ?? O,
          s.notes ?? null,
        )
        insertAssign.run(dayId, Number(r.lastInsertRowid), j)
        places++
      })
    })
    return places
  })

  let total = 0
  for (const [title, dayStops] of Object.entries(TRIPS)) {
    const tripId = byTitle[title]
    const n = seedTrip(title, tripId, dayStops)
    console.log(`OK #${tripId} ${title}: ${n} places across ${dayStops.length} days`)
    total += n
  }
  console.log(`\nDone. ${total} places seeded.`)
  db.close()
}

main()
