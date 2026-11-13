#!/usr/bin/env node
/**
 * One-shot: seed planned (dateless) itineraries for localuser (Ty).
 * Usage: node scripts/seed-ty-itineraries.mjs
 */
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../server/data/travel.db')
const USER_ID = 2 // localuser / Ty

/** @typedef {{ title: string, notes: string }} DaySeed */
/** @typedef {{ title: string, description: string, currency?: string, days: DaySeed[] }} TripSeed */

/** @type {TripSeed[]} */
const TRIPS = [
  {
    title: 'Central Asia: Kazakhstan, Kyrgyzstan & Uzbekistan',
    currency: 'USD',
    description:
      '20 days: Almaty → Bishkek → Tashkent → Samarkand → Bukhara → Khiva → home via UGC/TAS. No dates set. Visas: KZ 30d, KG 60d, UZ 30d visa-free (US). Keep every Uzbekistan hotel registration slip. Book Afrosiyob trains 45–60 days out. Land border Almaty–Bishkek can take hours — no tight flights that day. Cash-heavy (Tenge/Som/Soum); use Yandex Go. Best Apr–May or Sep–Oct; avoid Jul–Aug desert heat. Optional: Charyn Canyon; Margilan silk or Gijduvan ceramics between Samarkand and Bukhara.',
    days: [
      { title: 'Depart Chicago → Almaty', notes: 'ORD → ? → ALA. Overnight transit; keep schedule flexible for connection.' },
      { title: 'Arrival in Almaty', notes: 'Check into hotel. Walk Zhibek Zholy pedestrian street. Dinner: central tavern — shashlik or beshbarmak.' },
      { title: 'Almaty City Exploration', notes: '28 Panfilov Guardsmen Park + Zenkov Cathedral. Green Bazaar lunch (flatbreads, dried fruit, horse cheese). Cable car to Kok Tobe. Dinner: laghman or samsa.' },
      { title: 'Medeu + Shymbulak', notes: 'Morning cable car to Medeu; continue to Shymbulak. Mountain viewpoints and easy walking. Return to Almaty for dinner.' },
      { title: 'Kaindy + Kolsai Lakes', notes: 'Full-day lakes trip. Return to Almaty in the evening.' },
      { title: 'Almaty → Bishkek', notes: 'Private car or shared transit across land border — flexible morning for queues. Ala-Too Square + Manas changing of the guard. Osh Bazaar evening. Dinner: manty and tea.' },
      { title: 'Ala-Archa National Park', notes: '45-min drive south to Ala-Archa. Afternoon back in Bishkek parks/markets. Dinner: ashlyam-fu or stir-fried noodles.' },
      { title: 'Burana Tower → Tashkent', notes: 'Morning Burana Tower + balbals. Afternoon flight/connection to Tashkent. Arrive, customs, hotel. Collect hotel registration slip (mandatory).' },
      { title: 'Tashkent Architectural Tour', notes: 'Hazrati Imam + Uthman Quran library (closed Sundays). Lunch at Besh Qozon plov. Chorsu Bazaar non bread. Metro: Kosmonavtlar, Alisher Navoi.' },
      { title: 'Tashkent → Samarkand', notes: 'Morning Afrosiyob (~2h; book 4+ weeks early). Registan / Ulugh Beg Madrasa; Siab Bazaar. Plov or kebabs. Evening Bibi-Khanym + old town. Registan night show 8:30 / laser 9:00.' },
      { title: 'Samarkand Deep Day', notes: 'Shah-i-Zinda morning. Gur-e-Amir; Ulugh Beg Observatory remains. Dinner: manti or savory pastries near Registan.' },
      { title: 'Samarkand → Bukhara', notes: 'Afrosiyob west (~1.5h). Labi Hovuz / Lyabi-Hauz; Toki Sarrofon. Dinner overlooking pool — shurpa + green tea. Night walk around illuminated mulberries.' },
      { title: 'Bukhara Historic Core', notes: 'Kalon Mosque + Minaret. Ark of Bukhara; Zindon prison; Chor Minor. Late dinner in a caravanserai. Night walk Kalon complex.' },
      { title: 'Bukhara Breathing Room', notes: 'Morning Sitorai Mokhi-Khosa. Afternoon free: bazaar alleys, hammam, or reading by the pools.' },
      { title: 'Bukhara → Khiva', notes: 'All-day 5–6h train or private transfer across Kyzylkum. Check into guesthouse in/near Ichan-Kala. Sunset on mud walls.' },
      { title: 'Khiva Open-Air Museum', notes: 'Ichan-Kala: Kalta-Minor, Juma Mosque. Afternoon Tash-Khovli Palace. Sunset climb Kunya-Ark watchtower. Dinner: shivit oshi or meat pies.' },
      { title: 'Khorezm Desert Fortresses', notes: 'Full-day Karakalpakstan plains: Toprak-Kala, Ayaz-Kala, etc.' },
      { title: 'Khiva → Urgench / Tashkent Buffer', notes: '30-min taxi to UGC. UGC → TAS. Low-stress evening buffer.' },
      { title: 'International Departure', notes: 'TAS → ? → ORD.' },
      { title: 'Arrive Chicago', notes: 'Land ORD.' },
    ],
  },
  {
    title: 'Southeast Asia: Thailand, Cambodia & Vietnam',
    currency: 'USD',
    description:
      '21 days: Bangkok → Chiang Mai → Siem Reap → Phnom Penh → Hanoi/Ninh Binh → Hoi An → Ho Chi Minh → home via BKK. No dates set. Best ~March (dry); avoid Songkran/Khmer New Year mid-Apr and northern Thailand burning season Mar–Apr; monsoon Jul–Sep. Visas: TH 30d free; KH/VN e-visa ~$25–36. AirAsia domestics $50–100; Giant Ibis buses; Grab. Optional: Sapa rice terraces from Hanoi. Chiang Rai day trip is a flexible Chiang Mai option.',
    days: [
      { title: 'Bangkok Temples + Muay Thai', notes: 'Grand Palace; Wat Phra Kaew; Wat Pho. Evening Rajadamnern Muay Thai (~$80). Hotel: Khao San / Rambuttri area (~$40).' },
      { title: 'Bangkok Markets & Chinatown', notes: 'Wat Arun sunrise. Amulet Market (Tha Phrachan); Tha Tian Market; Bangkok National Museum. Evening Yaowarat street food.' },
      { title: 'Ayutthaya Day Trip', notes: 'Train ~$2/1h; tuk-tuk ~$20. Wat Mahathat, Chaiwatthanaram sunset, Phra Si Sanphet, Lokayasutharam, Yai Chaya Mongkol, Bang Pa-In.' },
      { title: 'Bangkok → Chiang Mai', notes: 'BKK → CNX (~$50, 1h). Doi Suthep hike (songthaew ~$5 up, ~1h trek). Hotel: Old City e.g. De Chai (~$50).' },
      { title: 'Elephants & Chiang Mai Temples', notes: 'Elephant Jungle Sanctuary (~$80). Wat Chedi Luang; Wat Phra Singh; Wat Sri Suphan (Silver Temple). Alt: Chiang Rai day trip (~$40, White Temple + Rong Suea Ten).' },
      { title: 'Sukhothai Ruins', notes: 'Bus ~5h/$20 RT or flight ~$60; bike rental ~$5 among the ruins.' },
      { title: 'Doi Inthanon', notes: 'National park hikes/waterfalls. Rong Suea Ten viewpoint if not done on Chiang Rai day.' },
      { title: 'Fly to Siem Reap + Angkor Wat', notes: 'CNX → BKK → REP (~$100). Angkor Wat sunrise/full explore. 3-day Angkor pass ~$62; remork/bike ~$20/day. Hotel: Pub Street e.g. Onederz (~$25).' },
      { title: 'Bayon & Ta Prohm', notes: 'Bayon faces; Ta Prohm jungle ruins.' },
      { title: 'Beng Mealea', notes: 'Overgrown jungle Angkor; ~$5 tuk-tuk ~1h.' },
      { title: 'Angkor Bike Paths', notes: 'Angkor Thom gates, Preah Khan by bike.' },
      { title: 'Siem Reap Free + Bus to PP', notes: 'Markets / Artisans Angkor. Afternoon Giant Ibis to Phnom Penh (~$20, 6h).' },
      { title: 'Phnom Penh Core', notes: 'Tuol Sleng (S21); Royal Palace; Silver Pagoda. Hotel: Riverside e.g. Billabong (~$30).' },
      { title: 'Phnom Penh Museums', notes: 'National Museum; Choeung Ek Killing Fields; Wat Phnom.' },
      { title: 'Phnom Penh → Hanoi', notes: 'PNH → HAN flight (~$100). Old Quarter; Hoan Kiem Lake. Hotel: Old Quarter e.g. Hanoi City Hostel (~$25).' },
      { title: 'Ninh Binh + Mausoleum', notes: 'Ninh Binh day (train/bus ~2h/$10): Trang An caves/rice terraces. Ho Chi Minh Mausoleum.' },
      { title: 'Hanoi Culture Day', notes: 'Water puppets, markets near station; Temple of Literature.' },
      { title: 'Hanoi → Hoi An', notes: 'HAN → DAD (~$80, 1h). Lantern old town, tailor shops. Hotel: Old Town e.g. TNT Villa (~$30).' },
      { title: 'My Son Sanctuary', notes: 'Cham ruins day trip (~$20 bus/guide). Chùa Cầu Japanese Bridge area.' },
      { title: 'Hoi An Central', notes: 'Japanese Bridge, markets, assembly halls — open exploring.' },
      { title: 'Ho Chi Minh City → Home', notes: 'DAD → SGN (~$80). Cu Chi (~$20), War Remnants, Ben Thanh, Independence Palace. SGN → BKK → ORD. Hotel District 1 if overnight (~$25).' },
    ],
  },
  {
    title: 'Greece & the Balkans: Athens to Sarajevo',
    currency: 'EUR',
    description:
      '24 days overland: Athens/Delphi → Meteora → Zagori/Vikos → Ohrid → Gjirokastër → Kotor → Dubrovnik → Mostar → Sarajevo → home. No dates set. Hotels noted by region (Koukaki, Kastraki, Zagori, Ohrid Old Town, etc.).',
    days: [
      { title: 'Departure', notes: 'ORD → ATH.' },
      { title: 'Athens Arrival', notes: 'Explore Plaka. Dinner: souvlaki, grilled meats, mezze. Hotel: Koukaki.' },
      { title: 'Acropolis', notes: 'Acropolis, Parthenon, Erechtheion, Theater of Dionysus; Acropolis Museum.' },
      { title: 'Delphi Excursion', notes: 'Sanctuary of Apollo, theater, stadium, archaeological museum.' },
      { title: 'Athens to Kalabaka', notes: 'Ancient Agora, Roman Forum, National Archaeological Museum; afternoon train to Kalabaka.' },
      { title: 'Explore Meteora', notes: 'Rock pillars and Byzantine monasteries. Hotel: Kastraki Village.' },
      { title: 'Transit to Zagori', notes: 'More monasteries; continue west to Zagori region.' },
      { title: 'Zagori Villages', notes: 'Stone villages and Ottoman-era arched bridges. Hotel: Zagori village guesthouse.' },
      { title: 'Vikos Gorge', notes: 'Hike sections of Vikos Gorge; continue north toward North Macedonia.' },
      { title: 'Lake Ohrid', notes: 'Lakeshore promenade; Church of Saint John at Kaneo. Hotel: Ohrid Old Town.' },
      { title: 'Medieval Ohrid → Albania', notes: 'Tsar Samuel Fortress, Ancient Theatre, medieval churches; cross into Albania.' },
      { title: 'Gjirokastër', notes: 'Steep cobbled streets and hilltop fortress. Hotel: traditional Ottoman mansion.' },
      { title: 'Tower Houses', notes: 'Fortified tower houses; views across Drino Valley.' },
      { title: 'Montenegro / Kotor', notes: 'Travel to Montenegro; evening in Kotor’s walled Old Town. Hotel: Kotor Old Town.' },
      { title: 'San Giovanni & Perast', notes: 'Hike San Giovanni Fortress; Perast and Our Lady of the Rocks.' },
      { title: 'Dubrovnik Arrival', notes: 'Dubrovnik Old Town; fortified gates and squares. Hotel: Dubrovnik Old Town.' },
      { title: 'City Walls', notes: 'Circuit atop medieval walls; Fort Lovrijenac.' },
      { title: 'Mostar / Stari Most', notes: 'Historic bazaar and Stari Most bridge. Hotel: Mostar Old Bazaar.' },
      { title: 'Blagaj Tekke', notes: 'Dervish monastery excursion; optional Kravica Waterfalls.' },
      { title: 'Sarajevo Arrival', notes: 'Baščaršija; Bosnian coffee and ćevapi. Hotel: Sarajevo Old Town.' },
      { title: 'Sarajevo History', notes: 'Latin Bridge, City Hall, Tunnel of Hope Museum.' },
      { title: 'Sarajevo Open Day', notes: 'Mount Trebević, Olympic bobsled track, cafés.' },
      { title: 'Depart Sarajevo', notes: 'SJJ via European hub.' },
      { title: 'Arrive Chicago', notes: 'ORD.' },
    ],
  },
  {
    title: 'Japan: Tokyo, Kyoto, Osaka & Kanazawa',
    currency: 'JPY',
    description:
      '16 days: Tokyo (5) → Hakone → Kyoto (5) → Kanazawa (2) → Osaka/Himeji (2) → home. No dates set. Best mid-May; avoid cherry blossom peak, Golden Week, mid-summer. Load Suica/Pasmo before leaving Chicago; JR Pass or ICOCA/Suica. Food hits: Daikokuya, Asakusa Imahan, Afuri, Uobei, Motomura, Ichi Ni San, Yamabe, Ginza Kagari. Akihabara Pokémon: Otachu/PDG, YK Trading, Valuable Card Tokyo (cash), El Dorado, Hareruya 2, 福福トレカ.',
    days: [
      { title: 'Travel Day → Tokyo', notes: 'ORD → NRT (~13h). N’EX to Shinjuku (~¥3,000). Hotel Shinjuku. Asakusa/Nakamise day+night; Sumida River; Tempura Daikokuya or Asakusa Imahan; Tokyo Skytree (~¥3,100).' },
      { title: 'Meiji, Harajuku & Shibuya', notes: 'Konbini breakfast. Meiji Shrine + Yoyogi. Takeshita Street; Afuri ramen. Shibuya Crossing, Hachiko, Shibuya Sky. Dinner: Uobei or Gyukatsu Motomura.' },
      { title: 'Ueno & Akihabara Pokémon Hunt', notes: 'Tokyo National Museum 4+h; Ueno Park; Tonkatsu Yamabe. Card shops: PDG/Otachu, YK, Valuable Card Tokyo (cash), El Dorado, Hareruya 2, 福福トレカ. Dinner: Gyukatsu Ichi Ni San.' },
      { title: 'Art, Markets & Ginza', notes: 'teamLab Planets 9:00 pre-book. Toyosu lunch. Imperial Palace East Gardens. Pokémon Center Tokyo DX. Dinner: Ginza Kagari.' },
      { title: 'Kamakura Day Trip', notes: 'Great Buddha, Hasedera, Tsurugaoka Hachimangu, Komachi Street; optional Daibutsu trail. Dinner back in Tokyo.' },
      { title: 'Tokyo → Hakone', notes: 'Romancecar or Shinkansen. Hakone Loop: ropeway, Owakudani, Lake Ashi, Hakone Shrine. Ryokan + kaiseki + onsen.' },
      { title: 'Kyoto: Fushimi Inari', notes: 'Travel to Kyoto. Pre-sunrise Fushimi Inari full 4km summit. Dinner: Kyoto Ramen Sen-no-Kaze. Hotel: Gion.' },
      { title: 'Higashiyama & Gion', notes: 'Kiyomizu-dera, Higashiyama, Sannenzaka, Ninenzaka, Gion. Dinner: Gion Kappa.' },
      { title: 'Arashiyama', notes: 'Bamboo Grove, Tenryu-ji, Monkey Park, Okochi Sanso. Dinner: Arashiyama Yoshimura.' },
      { title: 'Nara Day Trip', notes: 'Todai-ji Great Buddha, Kasuga Taisha, Deer Park; optional Naramachi.' },
      { title: 'Northwest Kyoto', notes: 'Kinkaku-ji, Ryoan-ji, Nijo Castle, Philosopher’s Path. Dinner: kaiseki/Kyoto-style.' },
      { title: 'Kyoto → Kanazawa', notes: 'Kenrokuen, Kanazawa Castle, Omicho Market. Seafood dinner.' },
      { title: 'Kanazawa Districts', notes: 'Nagamachi Samurai District, Nomura House, Higashi Chaya; optional 21st Century Museum.' },
      { title: 'Kanazawa → Osaka', notes: 'Osaka Castle, Kuromon Market, Dotonbori. Takoyaki, okonomiyaki, kushikatsu.' },
      { title: 'Himeji Day Trip', notes: 'Himeji Castle + Koko-en; optional Kobe on return. Dinner Dotonbori.' },
      { title: 'Return to Chicago', notes: 'Haruka Express → KIX → ORD.' },
    ],
  },
  {
    title: 'Morocco & Tunisia: Sahara to Carthage',
    currency: 'USD',
    description:
      '~23 days: Casablanca/Rabat → Chefchaouen → Volubilis/Meknes → Fes → Merzouga Sahara → Todra/Dades → Aït Benhaddou → Marrakech → Tunis/Carthage/Sidi Bou Said/Dougga → El Jem → Kairouan → Tozeur/Matmata → home. No dates set. Best Mar–May or Oct–Nov; avoid Jun–Aug desert heat. Fast-paced with long drives. Optional: Essaouira, Imlil, Merenid Tombs; Tunisia Chebika/Tamerza, Sbeitla. Food: tagine, couscous, pastilla, harira, brik, lablabi, merguez, makroudh.',
    days: [
      { title: 'Departure', notes: 'ORD → CMN.' },
      { title: 'Casablanca → Rabat', notes: 'Hassan II Mosque + Corniche. Train to Rabat. Hotel: Rabat.' },
      { title: 'Rabat Exploration', notes: 'Kasbah of the Udayas, Andalusian Gardens, Hassan Tower, Mausoleum of Mohammed V, Medina.' },
      { title: 'Chefchaouen', notes: 'Travel to blue city. Plaza Uta el-Hammam, Ras El Maa, sunset viewpoint.' },
      { title: 'Volubilis & Meknes → Fes', notes: 'Volubilis mosaics; Meknes (Bab Mansour, Heri es-Souani, Moulay Ismail). Continue to Fes.' },
      { title: 'Fes Medina', notes: 'Fes el-Bali: Bou Inania, Chouara tannery views, Nejjarine, Al-Attarine, souks. Hotel: Fes.' },
      { title: 'Atlas → Merzouga', notes: 'Middle Atlas via Azrou cedars and Ziz Valley viewpoints. Arrive Merzouga.' },
      { title: 'Sahara Desert', notes: 'Erg Chebbi dunes: camel or 4x4, sunset, Berber music, desert camp, stargazing.' },
      { title: 'Todra & Dades', notes: 'Sunrise Erg Chebbi; Todra Gorge hike; Dades Valley viewpoints. Hotel: kasbah.' },
      { title: 'Aït Benhaddou → Marrakech', notes: 'Explore ksar; High Atlas / Tizi n’Tichka Pass; arrive Marrakech.' },
      { title: 'Marrakech Highlights', notes: 'Bahia Palace, Ben Youssef Madrasa, Koutoubia, souks, Jemaa el-Fnaa food stalls.' },
      { title: 'Marrakech & Fly Tunis', notes: 'Majorelle, Le Jardin Secret, Saadian Tombs; optional hammam. Evening flight to Tunis. Hotel: Tunis.' },
      { title: 'Tunis Arrival', notes: 'Medina, Zitouna exterior, Bardo National Museum.' },
      { title: 'Carthage', notes: 'Punic Ports, Antonine Baths, Byrsa Hill, Carthage Museum, Roman Villas.' },
      { title: 'Sidi Bou Said', notes: 'Gulf of Tunis viewpoints and coastal walks. Hotel base: Sidi Bou Said.' },
      { title: 'Cap Bon / Kerkouane', notes: 'Kerkouane Punic ruins and coast; return Tunis.' },
      { title: 'Dougga Excursion', notes: 'Full day: Roman theater, Capitol, forum, baths, residential quarter; return Tunis.' },
      { title: 'El Jem → Kairouan', notes: 'El Jem Amphitheater + underground; continue to Kairouan.' },
      { title: 'Kairouan → Tozeur', notes: 'Great Mosque, medina, Aghlabid Basins, Barber’s Mosque; continue Tozeur. Hotel: Tozeur.' },
      { title: 'Tozeur & Chott el Jerid', notes: 'Palm oasis, old medina, salt flats, Star Wars filming locations.' },
      { title: 'Matmata → Tunis', notes: 'Troglodyte pit houses and Berber villages; return north toward Tunis. Hotel: airport area.' },
      { title: 'Departure', notes: 'Depart TUN.' },
      { title: 'Arrive Chicago', notes: 'ORD.' },
    ],
  },
  {
    title: 'Iceland & Norway: Ring Road to the Fjords',
    currency: 'USD',
    description:
      '15 days: Iceland Ring Road (~10) then Bergen/fjords (~5). No dates set. Camping-oriented Iceland days (~$20/night). Monitor road.is + safetravel.is. Never turn back on ocean at Reynisfjara (sneaker waves). Best late May shoulder; avoid deep winter; peak Jul–Aug crowded/expensive. Optional: Askja (late summer F-roads), Westfjords +4 days. Book Silfra (Dive.is) ~2 months ahead; glacier hike with Icelandic Mountain Guides.',
    days: [
      { title: 'Golden Circle', notes: '~120 mi. Thingvellir; Silfra snorkel (~$130, book Dive.is 2mo); Bruarfoss; Strokkur; Gullfoss; Kerid ($5); Reykjadalur hot springs. Camp Selfoss (~$20).' },
      { title: 'Westman Islands', notes: 'Selfoss → Landeyjahofn ferry (~$30 RT). Eldfell hike, Elephant Rock, Eldheimar museum ($15). Ferry back; camp Vik.' },
      { title: 'South Coast', notes: 'Seljalandsfoss, Gljufrabui, Seljavallalaug, Skogafoss, Kvernufoss; Solheimajokull glacier hike (~$80); Dyrholaey; Reynisfjara (stay 50ft back); Vik church. Camp Vik/Skaftafell.' },
      { title: 'Canyons & Skaftafell', notes: 'Eldhraun; Fjadrargljufur; Dverghamrar; Foss á Síðu; Svartifoss hike; Hofskirkja; Múlagljúfur. Camp Skaftafell (~$25).' },
      { title: 'Southeast Glaciers', notes: 'Fjallsárlón; Jökulsárlón (+ optional boat $60); Diamond Beach; Stokksnes/Vestrahorn ($10; sunrise). Camp Höfn.' },
      { title: 'East Fjords', notes: '~150 mi. Fjord lighthouse; Seyðisfjörður blue church/rainbow path; Hengifoss hike. Camp Egilsstaðir.' },
      { title: 'North Iceland', notes: 'Dettifoss; Víti crater ($10); Mývatn Nature Baths ($50); Goðafoss. Camp Mývatn.' },
      { title: 'North to West', notes: 'Húsavík whales (~$100, North Sailing); Akureyri; Hvítserkur (tide timing). Camp Blönduós.' },
      { title: 'Snæfellsnes', notes: 'Kirkjufell; Búðakirkja; Gatklettur; Lóndrangar. Camp Snæfellsnes.' },
      { title: 'Glymur + Reykjavík → Bergen', notes: 'Glymur hike (dry bag for river). Reykjavík walk (Sun Voyager, Hallgrímskirkja). Blue/Sky Lagoon. Fly to Bergen.' },
      { title: 'Bergen', notes: 'Mt. Fløyen; Bryggen; evening harbor.' },
      { title: 'Norway in a Nutshell', notes: 'Nærøyfjord, Aurlandsfjord, Flåm.' },
      { title: 'Stegastein & Lærdal', notes: 'Stegastein Viewpoint; Borgund Stave Church; Lærdal.' },
      { title: 'Trollstigen & Geiranger', notes: 'Trollstigen if open; Geirangerfjord.' },
      { title: 'Seven Sisters → Home', notes: 'Seven Sisters waterfall; Dalsnibba; fly home.' },
    ],
  },
  {
    title: 'Central Europe: Prague to Budapest',
    currency: 'EUR',
    description:
      '12 days: Prague (3) → Salzburg → St. Wolfgang / Salzkammergut → Vienna → Budapest (2) → home. No dates set. Option: cut St. Wolfgang overnights for 2 nights Salzburg with Hallstatt as day trip, then Vienna. Book Schönbrunn 4+ weeks ahead.',
    days: [
      { title: 'Depart Chicago', notes: 'Evening ORD → PRG.' },
      { title: 'Arrival in Prague', notes: 'Settle in. Old Town Square + Astronomical Clock. Food: chlebíčky at Sisters or svíčková; Lokál Dlouhááá or U Kroka.' },
      { title: 'Prague Depth', notes: 'Prague Castle via North Gate; St. Vitus; Golden Lane. Petřín funicular; Malá Strana; trdelník; optional Lennon Wall or Letná sunset. Evening Vltava cruise.' },
      { title: 'Prague Leisure', notes: 'Pick: Josefov (cemetery, Spanish Synagogue) OR National Museum + Vyšehrad OR Kutná Hora (Sedlec, St. Barbara). Afternoon Malá Strana cafés; smažený sýr. Evening Czech dinner + live music.' },
      { title: 'Transit to Salzburg', notes: 'Early train Prague → Salzburg (~6h). Mirabell Gardens; Mozart’s Birthplace. Wiener schnitzel at Gasthof Goldgasse; Getreidegasse stroll.' },
      { title: 'Salzburg & Lake Transit', notes: 'Hohensalzburg Fortress funicular. Afternoon to St. Wolfgang lakeside base. Lake trout (Reinanke); Kaiserschmarrn, Kasnocken.' },
      { title: 'Hallstatt Day Trip', notes: 'Early bus/ferry to Hallstatt — salt mine or Five Fingers. Return St. Wolfgang for quiet afternoon.' },
      { title: 'Transit to Vienna', notes: 'Bus then train to Vienna. Schönbrunn (book 4+ weeks). Apfelstrudel or Sachertorte at Café Sacher.' },
      { title: 'Imperial Vienna', notes: 'Kunsthistorisches or Imperial Crypt. Coffeehouse + City Park; St. Stephen’s, Hofburg courtyards, or National Library State Hall. Evening tafelspitz.' },
      { title: 'Transit to Budapest', notes: 'Early train Vienna → Budapest. Pest: St. Stephen’s, Parliament, Jewish Quarter. Lángos at Retró. Sunset Danube cruise + Shoes on the Danube.' },
      { title: 'Budapest Exploration', notes: 'Sunrise Fisherman’s Bastion + Buda Castle (before 9). Hospital in the Rock. Evening Jewish Quarter; paprikás csirke.' },
      { title: 'Budapest Departure', notes: 'Hungarian National Museum or Great Market Hall; túró rudi. 100E Airport Express to BUD.' },
    ],
  },
  {
    title: 'Portugal: Lisbon, Évora & Porto',
    currency: 'EUR',
    description:
      '12 days: Lisbon (4 incl. Sintra) → Évora (2) → Porto (3 incl. Douro) → Braga/Guimarães (2) → home from Porto. No dates set. Flights: ORD → LIS; Porto → ORD. Food: pastel de nata, bacalhau, polvo à lagareiro, francesinha, bifana, piri-piri, arroz de marisco, sardines, port, ginjinha.',
    days: [
      { title: 'Arrival & Baixa', notes: 'Morning arrival. Praça do Comércio, Rua Augusta, Santa Justa Lift. Dinner bacalhau / pastéis de bacalhau; Pastéis de Belém for dessert. Base Baixa/Chiado.' },
      { title: 'Historic Lisbon', notes: 'Cathedral, Castelo de São Jorge, Alfama, miradouros. Lunch Cervejaria Ramiro. National Tile Museum; Tram 28. Fado dinner.' },
      { title: 'Belém District', notes: 'Jerónimos, Monument to the Discoveries, Belém Tower; optional MAAT. Pastéis de Belém lunch. Afternoon LX Factory.' },
      { title: 'Sintra Day Trip', notes: 'Early: Pena Palace, Moorish Castle, historic center, Quinta da Regaleira. Return Lisbon.' },
      { title: 'Évora Historic Center', notes: 'Drive/train ~1.5h. Roman Temple, Cathedral, Bone Chapel, historic center. Alentejo food. Hotel historic center.' },
      { title: 'Évora Megaliths', notes: 'Almendres Cromlech, dolmens, nearby Roman ruins.' },
      { title: 'Arrival Porto', notes: 'Train to Porto. Ribeira, Dom Luís Bridge, port cellar, Livraria Lello, São Bento, Cathedral, São Francisco. Hotel Ribeira.' },
      { title: 'Douro Valley Day Trip', notes: 'Wine estates, boat cruise, scenery.' },
      { title: 'Porto Open Day', notes: 'Open exploring Ribeira / city.' },
      { title: 'Braga Base', notes: 'Braga Cathedral; Bom Jesus do Monte. Hotel Braga.' },
      { title: 'Guimarães', notes: 'Castle, palace, historic center; optional Citânia de Briteiros.' },
      { title: 'Depart', notes: 'Return Porto; fly home.' },
    ],
  },
  {
    title: 'Guatemala: Antigua, Acatenango & Atitlán',
    currency: 'USD',
    description:
      '6 days (Option B adds 1): Antigua → Acatenango overnight → Lake Atitlán → GUA home. No dates set. Best Mar–Apr dry season; avoid Semana Santa surcharges and Jun–Oct rains. Use tourist shuttles/private drivers — not chicken buses. Volcano hikes only with registered guides. Optional: Semuc Champey loop; Yaxha near Tikal.',
    days: [
      { title: 'Arrival → Antigua', notes: 'ORD → GUA by midday if possible. Shuttle GUA → Antigua (~45 min, $25). 2–4 PM walking tour (plazas, La Merced, Santa Catalina Arch; tip ~$10). Dinner $15–20.' },
      { title: 'Antigua & Volcano Prep', notes: 'Optional 8 AM coffee plantation (~$25). Free time markets or Museo Casa Santo Domingo ($12). 4 PM gear check; early dinner; rest.' },
      { title: 'Acatenango Ascent', notes: '5 AM pickup; La Soledad trailhead. Hike 3–4 mi / 4–6h (~3,000 ft gain). Basecamp ~12,300 ft by 2 PM; Fuego views ~4 PM. Tour ~$120 (guide, meals, tents, transport).' },
      { title: 'Summit Sunrise → Antigua', notes: '4:30 AM summit for sunrise; descend 4–5h; Antigua ~1 PM. Recovery afternoon; dinner $15.' },
      { title: 'Antigua → Lake Atitlán', notes: '8 AM shuttle to Panajachel (2.5h, $25). 11 AM boat villages San Juan/Santiago (3–4h, $20). Hotel Atitlán (~$130). Lakeside dinner optional.' },
      { title: 'Atitlán → Home', notes: 'Option A tight: 7 AM boat to San Pedro + Indian Nose ($10), 11 AM shuttle to GUA (4h, $35), late flight. Option B: sleep in, markets/kayak ($20), next-day departure.' },
    ],
  },
  {
    title: 'Canadian Rockies: Banff to Jasper',
    currency: 'USD',
    description:
      '7 days: Banff (2) → Lake Louise (2) → Jasper (2) → YEG home. No dates set. Rental car YYC→Banff→Icefields→Jasper→YEG. Reserve Lake Louise & Moraine shuttles. Best late Jun–early Sep; early Sep often best compromise; late Sep larches/cold. Watch wildfire smoke in August.',
    days: [
      { title: 'Chicago → Calgary → Banff', notes: 'Arrive YYC; rental; ~1.5–2h to Banff. Banff Avenue, Bow Falls, Surprise Corner; sunset Vermilion Lakes if timing allows. Overnight Banff.' },
      { title: 'Banff Canyons & Lakes', notes: '8 AM Johnston Canyon Upper Falls (5–6 km RT). Lake Minnewanka + Two Jack. Banff Gondola / Sulphur Mountain. Dinner Banff. Overnight Banff.' },
      { title: 'Lake Louise & Lake Agnes', notes: 'Drive ~45 min; reserved shuttle. Lakeshore + Victoria Glacier; hike Lake Agnes Tea House; optional Big Beehive (4–5.5h). Overnight Lake Louise area or Field BC.' },
      { title: 'Moraine Lake + Yoho', notes: 'Reserved Moraine shuttle; Rockpile + lakeshore. Afternoon Emerald Lake + Takakkaw Falls. Overnight Lake Louise area.' },
      { title: 'Icefields Parkway', notes: 'Lake Louise → Jasper ~232 km / 9–11h with stops. Overnight Jasper.' },
      { title: 'Maligne Lake & Spirit Island', notes: 'Maligne via Medicine Lake; boat cruise to Spirit Island. Lake hike or return Jasper; Pyramid + Patricia Lakes. Dinner; optional stargazing.' },
      { title: 'Jasper → Edmonton → Chicago', notes: 'Breakfast Jasper; ~4.5–5h drive to YEG; return car; fly home.' },
    ],
  },
  {
    title: 'Northern China: Beijing to Xi\'an',
    currency: 'USD',
    description:
      '21 days: Beijing (5) → Datong (2) → Pingyao (2) → Luoyang/Kaifeng (3) → Xi\'an (6) → home. No dates set. Flights ~$1,150 ORD→PEK/PKX; ~$1,200 XIY→ORD with connection. Best Apr–May; avoid Golden Week Oct 1–7, Labor Day early May, deep winter. Passport at every rail gate. VPN before arrival. Optional: Maijishan from Xi\'an west; Hukou Waterfall from Linfen.',
    days: [
      { title: 'Flight from Chicago', notes: 'ORD transpacific to Beijing (~14–15h direct).' },
      { title: 'Beijing Arrival', notes: 'Land ~2:30 PM. AREX to center. Qianmen walk; Peking Duck welcome (~$35). Hotel: Dongcheng.' },
      { title: 'Forbidden City & Jingshan', notes: 'Forbidden City halls; skyline over roofs from Jingshan Park.' },
      { title: 'Mutianyu & Summer Palace', notes: 'Early Mutianyu Great Wall; afternoon Summer Palace lakeside pavilions.' },
      { title: 'Temple of Heaven & National Museum', notes: 'Temple of Heaven morning; National Museum of China afternoon.' },
      { title: 'Hutongs Buffer', notes: 'Bell & Drum Towers hutongs; Lama Temple — flexible day.' },
      { title: 'Beijing → Datong / Yungang', notes: '8 AM bullet (~2h). Yungang Grottoes (~$17, 51k+ statues). Hotel: Datong Old Town.' },
      { title: 'Hanging Temple & Walls', notes: 'Xuankong Si cliff temple; afternoon Datong Old City Walls.' },
      { title: 'Datong → Pingyao', notes: 'Morning bullet south (~2.5h). Vehicle-free Ming/Qing streets. Hotel: Courtyard Han Inn.' },
      { title: 'Pingyao Banks & Yamen', notes: 'Rishengchang proto-bank vaults; ancient county yamen.' },
      { title: 'Pingyao → Luoyang / Longmen', notes: 'HSR to Luoyang (~2h). Longmen Grottoes on Yi River cliffs. Hotel: Luoyang Center.' },
      { title: 'Kaifeng Day Trip', notes: '1h rail to Kaifeng: Millennium City Park, Iron Pagoda; return Luoyang.' },
      { title: 'White Horse Temple & Museum', notes: 'First Buddhist temple tradition; Luoyang Museum Tang sancai ceramics.' },
      { title: 'Luoyang → Xi\'an', notes: 'HSR ~1.5h. Evening Muslim Quarter crawl — yangrou paomo (~$15). Hotel: Xi\'an City Center.' },
      { title: 'Terracotta Army & City Wall', notes: 'Terracotta pits (~$16); cycle/walk Xi\'an City Wall (~$8).' },
      { title: 'Pagoda & History Museum', notes: 'Big Wild Goose Pagoda; Shaanxi History Museum gold/bronze galleries.' },
      { title: 'Mount Huashan', notes: 'Day trip: cable car or hike granite cliffs.' },
      { title: 'Hanyangling & Great Mosque', notes: 'Han underground mausoleum miniature figures; Great Mosque of Xi\'an.' },
      { title: 'Xi\'an Buffer Day', notes: 'Open neighborhood, tea, markets.' },
      { title: 'Depart Xi\'an', notes: 'XIY via Beijing or Shanghai connection.' },
      { title: 'Arrive Chicago', notes: 'ORD same calendar day.' },
    ],
  },
  {
    title: 'Silk Road: Xi\'an to Kashgar',
    currency: 'USD',
    description:
      '21 days Hexi Corridor + Xinjiang: Xi\'an → Lanzhou → Zhangye → Jiayuguan → Dunhuang → Turpan → Kashgar → home. No dates set. Flights ~$1,100 ORD→XIY via TPE/ICN; ~$1,250 KHG→ORD via URC/PEK. Best May; avoid Jun–Aug Turpan heat (>115°F) and Mar–Apr Gobi dust storms. Xinjiang: frequent passport/ID checks — carry passport always; no photos of security. Optional: Shandan Horse Ranch; Gaochang near Turpan.',
    days: [
      { title: 'Departure', notes: 'Long-haul ORD → Xi\'an.' },
      { title: 'Xi\'an Arrival', notes: 'Illuminated Bell & Drum Towers. Biang biang noodles welcome. Hotel: Xi\'an Center.' },
      { title: 'Terracotta & City Wall', notes: 'Terracotta Warriors; walk/bike ancient City Wall.' },
      { title: 'Pagoda & Museum', notes: 'Big Wild Goose Pagoda; Shaanxi History Museum.' },
      { title: 'Xi\'an → Lanzhou', notes: 'Morning HSR (~3h). Yellow River Waterwheel Park; Zhongshan Iron Bridge; Lanzhou beef noodles. Hotel: Lanzhou Center.' },
      { title: 'Bingling Temple Caves', notes: 'Boat across Liujiaxia Reservoir to Bingling cliff Buddhist caves.' },
      { title: 'Lanzhou → Zhangye', notes: 'Bullet Hexi Corridor (~3h). Dafo Temple reclining Buddha (1098). Hotel: Zhangye Center.' },
      { title: 'Danxia Rainbow Mountains', notes: 'Early Zhangye Danxia Geopark; Binggou Danxia red mudstone hike.' },
      { title: 'Jiayuguan Pass', notes: '2h bullet west. Jiayuguan Pass fortress; Overhanging Great Wall over Gobi.' },
      { title: 'Arrive Dunhuang / Singing Sands', notes: 'Morning express to Dunhuang. Late afternoon Singing Sand Dunes + Crescent Lake sunset (~$15). Hotel: Dunhuang Silk Road Resort.' },
      { title: 'Mogao Caves', notes: 'Morning Mogao murals/grottoes. Evening Dunhuang Night Market skewers.' },
      { title: 'Yumen Pass & Yadan', notes: 'Jade Gate ruins; Yadan National Geological Park wind-carved rocks.' },
      { title: 'Dunhuang → Turpan', notes: '3.5h bullet into Xinjiang. Karez irrigation (~$5); Jiaohe Ancient City cliffs. Hotel: Turpan Silk Road Lodge.' },
      { title: 'Flaming Mountains & Emin', notes: 'Flaming Mountains; Emin Minaret Afghan-style brickwork.' },
      { title: 'Turpan → Kashgar', notes: 'HSR to Urumqi + short flight to Kashgar. Dive into Old City clay labyrinth. Hotel: Kashgar Old Town Inn.' },
      { title: 'Livestock Market & Bazaar', notes: 'If Sunday: Livestock Market. Afternoon Main Bazaar silk/spices/copper.' },
      { title: 'Mosques & Mausoleum', notes: 'Id Kah Mosque; Afaq Khoja Mausoleum.' },
      { title: 'Karakoram Highway Lakes', notes: 'Day drive toward Bulunkul + Karakul Lakes; Pamir glaciers; return Kashgar.' },
      { title: 'Kashgar Buffer', notes: 'Slow teahouses, mutton skewers, meat pies.' },
      { title: 'Depart Kashgar', notes: 'KHG multi-leg eastbound.' },
      { title: 'Arrive Chicago', notes: 'ORD after date line.' },
    ],
  },
  {
    title: 'Southwest China: Chengdu to Shangri-La',
    currency: 'USD',
    description:
      '21 days: Chengdu (4) → Chongqing (3) → Kunming (2) → Dali (3) → Lijiang (3) → Shangri-La (3) → home via DIG. No dates set. Flights ~$1,150 ORD→TFU; ~$1,250 DIG→ORD via CTU/KMG. Best Mar–May Yunnan spring; avoid Jun–Aug monsoon mudslides and Golden Week. Shangri-La ~10,600 ft — first afternoon easy, hydrate, light on alcohol. Optional: Baishuitai between Lijiang–Shangri-La; Qingcheng Mountain from Chengdu.',
    days: [
      { title: 'Departure from Chicago', notes: 'ORD toward Southwest China.' },
      { title: 'Chengdu Arrival', notes: 'People’s Park teahouses/bamboo. Sichuan hotpot. Hotel: Wuhou District.' },
      { title: 'Pandas & Kuanzhai', notes: 'Early Giant Panda Breeding Base. Afternoon Wide & Narrow Alleys.' },
      { title: 'Leshan Giant Buddha', notes: '1h HSR south; 233-ft Tang cliff Buddha (~$16); return Chengdu.' },
      { title: 'Wuhou & Du Fu', notes: 'Wuhou Shrine (Three Kingdoms); Du Fu Thatched Cottage.' },
      { title: 'Chengdu → Chongqing', notes: '1.5h bullet. Liziba monorail through building; evening Hongyadong neon. Hotel: Jiefangbei.' },
      { title: 'Dazu Rock Carvings', notes: 'Day trip UNESCO 9th-c cliff statues (Buddhist/Taoist/Confucian).' },
      { title: 'Yangtze Cable Car & Ciqikou', notes: 'River cable car skyline; Ciqikou Ancient Town wooden alleys.' },
      { title: 'Chongqing → Kunming', notes: 'Morning HSR (~4.5h). Green Lake Park musicians; crossing-the-bridge noodles. Hotel: Kunming Center.' },
      { title: 'Naigu Stone Forest', notes: 'Karst pillar labyrinth excursion.' },
      { title: 'Kunming → Dali', notes: '2h bullet. Dali Old Town stone gateways. Hotel: Old Town courtyard inn.' },
      { title: 'Erhai Lake Loop', notes: 'E-scooter/bike Erhai shores; Xizhou Bai village tie-dye.' },
      { title: 'Cangshan Mountains', notes: 'Cable car; Cloud Traveler’s Path; Three Pagodas views.' },
      { title: 'Dali → Lijiang', notes: '2h regional train. Dayan Old Town canals; Black Dragon Pool mountain frame. Hotel: Naxi guesthouse.' },
      { title: 'Jade Dragon Snow Mountain', notes: 'Blue Moon Valley turquoise glacier waters (~$35) under peaks.' },
      { title: 'Baisha Village', notes: 'Quiet day: Baisha Murals (Tibetan/Han/Naxi, 14th-c).' },
      { title: 'Lijiang → Shangri-La', notes: 'Coach/bus to ~10,000 ft. Acclimate: Dukezong Old Town + giant prayer wheel. Hotel: Tibetan-style inn.' },
      { title: 'Ganden Sumtseling', notes: 'Songzanlin “Little Potala” monastery (~$13).' },
      { title: 'Pudacuo National Park', notes: 'Alpine lakes, wetlands, yaks. Farewell Tibetan yak hotpot.' },
      { title: 'Depart Shangri-La', notes: 'DIG multi-leg to ORD.' },
      { title: 'Arrive Chicago', notes: 'ORD same calendar day.' },
    ],
  },
]

function main() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const user = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(USER_ID)
  if (!user) {
    console.error(`User id ${USER_ID} not found`)
    process.exit(1)
  }
  console.log(`Seeding for ${user.username} (${user.display_name || 'no display name'}) id=${user.id}`)

  const RENAME = {
    'Greece & the Balkans': 'Greece & the Balkans: Athens to Sarajevo',
    'Morocco & Tunisia': 'Morocco & Tunisia: Sahara to Carthage',
    'Iceland Ring Road & Norway Fjords': 'Iceland & Norway: Ring Road to the Fjords',
  }
  const renameTrip = db.prepare('UPDATE trips SET title = ? WHERE user_id = ? AND title = ?')
  for (const [oldTitle, newTitle] of Object.entries(RENAME)) {
    const r = renameTrip.run(newTitle, USER_ID, oldTitle)
    if (r.changes) console.log(`RENAMED "${oldTitle}" → "${newTitle}"`)
  }

  const existingTitles = new Set(
    db.prepare('SELECT title FROM trips WHERE user_id = ?').all(USER_ID).map((r) => r.title),
  )

  const insertTrip = db.prepare(`
    INSERT INTO trips (user_id, title, description, start_date, end_date, currency, reminder_days)
    VALUES (?, ?, ?, NULL, NULL, ?, 3)
  `)
  const insertDay = db.prepare(`
    INSERT INTO days (trip_id, day_number, date, title, notes)
    VALUES (?, ?, NULL, ?, ?)
  `)

  const seedOne = db.transaction((trip) => {
    if (existingTitles.has(trip.title)) {
      return { skipped: true, title: trip.title }
    }
    const result = insertTrip.run(USER_ID, trip.title, trip.description, trip.currency || 'USD')
    const tripId = Number(result.lastInsertRowid)
    trip.days.forEach((day, i) => {
      insertDay.run(tripId, i + 1, day.title, day.notes)
    })
    existingTitles.add(trip.title)
    return { skipped: false, title: trip.title, tripId, dayCount: trip.days.length }
  })

  let created = 0
  let skipped = 0
  for (const trip of TRIPS) {
    const out = seedOne(trip)
    if (out.skipped) {
      console.log(`SKIP (exists): ${out.title}`)
      skipped++
    } else {
      console.log(`OK #${out.tripId}: ${out.title} (${out.dayCount} days, no dates)`)
      created++
    }
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`)
  db.close()
}

main()
