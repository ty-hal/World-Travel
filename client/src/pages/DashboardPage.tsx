import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import Navbar from '../components/Layout/Navbar'
import DemoBanner from '../components/Layout/DemoBanner'
import TripFormModal from '../components/Trips/TripFormModal'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import CopyTripDialog from '../components/shared/CopyTripDialog'
import CustomSelect from '../components/shared/CustomSelect'
import PlaceAvatar from '../components/shared/PlaceAvatar'
import MobileTopBar from '../components/Layout/MobileTopBar'
import { useDashboard } from './dashboard/useDashboard'
import { TripSeasonsView } from './dashboard/TripSeasonsView'
import {
  type DashboardTrip, type HeroBundle, type TravelStats, type UpcomingReservation, type Place,
  type CompletedSortKey,
  MS_PER_DAY, daysUntil, getTripStatus, moveTripId,
} from './dashboard/dashboardModel'
import {
  Plus, Edit2, Trash2, Archive, Copy, ArrowRight, MapPin,
  Hotel, Utensils, Clock, ArrowRightLeft, Calendar, CloudSun, CloudRain, Droplets, Wind,
  LayoutGrid, List, X, CalendarPlus, ChevronLeft, ChevronRight,
} from 'lucide-react'

const ARRANGE_HOLD_MS = 420
const ARRANGE_MOVE_CANCEL_PX = 12
const ARRANGE_LIFT_PX = 6

type LiftState = {
  tripId: number
  index: number
  width: number
  height: number
  originLeft: number
  originTop: number
  dx: number
  dy: number
}
import AnimatedAirplaneIcon from '../components/shared/AnimatedAirplaneIcon'
import AnimatedTicketIcon from '../components/shared/AnimatedTicketIcon'
import AnimatedRefreshCwIcon from '../components/shared/AnimatedRefreshCwIcon'
import { IcsSubscribeModal } from '../components/Planner/IcsSubscribeModal'
import CollectionsWidget from '../components/Dashboard/CollectionsWidget'
import { entityGradient } from '../utils/gradients'
import PluginWidgets from '../components/Plugins/PluginWidgets'
import PluginFrame from '../components/Plugins/PluginFrame'
import { TripCardBadges, useTripCardBadges } from '../components/Plugins/TripCardBadges'
import type { TripCardBadge } from '../api/client'
import { mapsApi, weatherApi } from '../api/client'
import { fetchWeather } from '../services/weatherQueue'
import { usePluginStore } from '../store/pluginStore'
import { formatTime, splitReservationDateTime } from '../utils/formatters'
import { CURRENCIES } from '../components/Budget/BudgetPanel.constants'
import { convertDistance, getDistanceUnitLabel } from '../utils/units'
import { useSettingsStore } from '../store/settingsStore'
import { useAddonStore } from '../store/addonStore'
import { normalizeAppearance } from '@trek/shared'
import { currencyForCountryCode } from '../utils/countryCurrencies'
import '../styles/dashboard.css'

const DEFAULT_TRIP_COVERS: Record<string, string[]> = {
  'Mexico City': ['https://cdn.mos.cms.futurecdn.net/6Txsk2q5k3Hxho7cVhdrbV-1000-80.jpg'],
  'Peru & Easter Island: Andes to Rapa Nui': [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQjaYcjzofmBOHv9ZHeYgLz8KGTIu_SRiIuPOKqFQSwpw&s=10',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRh5sskw1tHtlYcKYpHu07Jlq7qNFoydTr7npFXEORqxw&s=10',
  ],
  'Middle East: Turkey, Egypt & Jordan': [
    'https://images.unsplash.com/photo-1600520611035-84157ad4084d?auto=format&fit=crop&w=1800&q=85',
    'https://images.unsplash.com/photo-1690440850413-d73785c4ac7d?auto=format&fit=crop&w=1800&q=85',
    'https://www.grayline.com/wp-content/uploads/2025/07/Blue-Mosque-1-scaled.jpg',
  ],
  'Arizona: Grand Canyon & Sedona': [
    'https://www.jasonweissphotography.com/images/xl/grand-canyon-toroweap-sunrise.jpg',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgkkTJr4Dxqt8GYXEQtrGTALBY23895exebFrnoHpeVQ&s=10',
  ],
  'Grand Canyon': ['https://www.jasonweissphotography.com/images/xl/grand-canyon-toroweap-sunrise.jpg'],
  'New England: Boston to Stowe': [
    'https://t3.ftcdn.net/jpg/03/12/98/38/240_F_312983834_7WSgFX4z0zyZ5zEBXGNyGGA2wklOP2HM.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/4/49/Portland_HeadLight_%28cropped%29.jpg',
  ],
  'Utah in Las Vegas': ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7sllsGS3cNKmYO-0Hm6B_mNsCGwk5GvLFE9m91mjnuOiQ6XPomjlmScPX&s=10'],
  'Utah': ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7sllsGS3cNKmYO-0Hm6B_mNsCGwk5GvLFE9m91mjnuOiQ6XPomjlmScPX&s=10'],
  'Utah & Las Vegas': [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7sllsGS3cNKmYO-0Hm6B_mNsCGwk5GvLFE9m91mjnuOiQ6XPomjlmScPX&s=10',
    'https://stgeorgeutahvacationrentals.icnd-cdn.com/images/blog/55C1282Eoriginal%20(3).webp',
  ],
  'Europe 2019': ['https://media.architecturaldigest.com/photos/66df5877d600aa994603fbd5/1:1/w_2000,h_2000,c_limit/GettyImages-1467072114.jpg'],
  'Europe Summer 2019': ['https://media.architecturaldigest.com/photos/66df5877d600aa994603fbd5/1:1/w_2000,h_2000,c_limit/GettyImages-1467072114.jpg'],
  'Europe Christmas 2018': ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT976cEHu0UJLTgqf-kgyi8rgxLmeCDO58Kz2V8gsfeKQ&s=10'],
  'England Christmas 2018': ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT976cEHu0UJLTgqf-kgyi8rgxLmeCDO58Kz2V8gsfeKQ&s=10'],
  'England: London Christmas': ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT976cEHu0UJLTgqf-kgyi8rgxLmeCDO58Kz2V8gsfeKQ&s=10'],
  'Europe Summer 2018': ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvtu4WkAs-joHP5dmM5SBJQG1YKo6vptKSv_1ExlMb0A&s=10'],
  'France & Italy: Paris to Naples': [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvtu4WkAs-joHP5dmM5SBJQG1YKo6vptKSv_1ExlMb0A&s=10',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTdJ-SFJ3MikeGtOvn0_1jsWH3IthRFQK2Y_cQnptK0Og&s=10',
  ],
  'Spain & Netherlands: Barcelona to Leiden': [
    'https://media.architecturaldigest.com/photos/66df5877d600aa994603fbd5/1:1/w_2000,h_2000,c_limit/GettyImages-1467072114.jpg',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4dTrpaCKM060835MWC6rImn7JJ2Om2XkJOknVB1PS8A&s=10',
  ],
  'Midwest: Chicago Loop': ['https://www.boboandchichi.com/wp-content/uploads/aerial-view-of-Madison-Wisconsin-and-the-Wisconsin-Capitol-Building.jpg'],
  'Central Asia: Kazakhstan, Kyrgyzstan & Uzbekistan': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Registan_01.jpg/1920px-Registan_01.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/View_over_Itchan_Kala_with_madrasas.jpg/1920px-View_over_Itchan_Kala_with_madrasas.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Mountains_in_the_National_Park_Ala_Archa_04.jpg/1920px-Mountains_in_the_National_Park_Ala_Archa_04.jpg',
  ],
  'Southeast Asia: Thailand, Cambodia & Vietnam': [
    'https://plus.unsplash.com/premium_photo-1661963188432-5de8a11f21a7?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDEyfHx8ZW58MHx8fHx8',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Wat_Arun_03-2012-01.JPG/1920px-Wat_Arun_03-2012-01.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Lanterns_in_Hoi_An%2C_Vietnam_%2825708206924%29.jpg/1920px-Lanterns_in_Hoi_An%2C_Vietnam_%2825708206924%29.jpg',
  ],
  'Greece & the Balkans: Athens to Sarajevo': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Across_the_Hill_to_Athena%27s_Temple.jpg/1920px-Across_the_Hill_to_Athena%27s_Temple.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Casco_viejo_de_Dubrovnik%2C_Croacia%2C_2014-04-14%2C_DD_07.JPG/1920px-Casco_viejo_de_Dubrovnik%2C_Croacia%2C_2014-04-14%2C_DD_07.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Mostar%2C_Stari_Most_at_night.jpg/1920px-Mostar%2C_Stari_Most_at_night.jpg',
  ],
  'Taiwan: Taipei to Kaohsiung': [
    'https://images.unsplash.com/photo-1563464284524-8229f8bcd56f?auto=format&fit=crop&w=1800&q=85',
    'https://images.unsplash.com/photo-1743653258442-a37c15086a59?auto=format&fit=crop&w=1800&q=85',
    'https://images.unsplash.com/photo-1759577362632-ce321d4387ce?auto=format&fit=crop&w=1800&q=85',
    'https://images.unsplash.com/photo-1774244874788-94046442a9d8?auto=format&fit=crop&w=1800&q=85',
    'https://images.unsplash.com/photo-1750441789294-45f2215d00e1?auto=format&fit=crop&w=1800&q=85',
  ],
  'Japan: Tokyo, Kyoto, Osaka & Kanazawa': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Chureito_Pagoda_and_Mount_Fuji_%2844951842365%29.jpg/1920px-Chureito_Pagoda_and_Mount_Fuji_%2844951842365%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg/1920px-Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Water_reflection_of_Kinkaku-ji_Temple_with_blue_sky_and_white_clouds%2C_Kyoto%2C_Japan.jpg/1920px-Water_reflection_of_Kinkaku-ji_Temple_with_blue_sky_and_white_clouds%2C_Kyoto%2C_Japan.jpg',
  ],
  'Morocco & Tunisia: Sahara to Carthage': [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTlkXte3qJk8Q-QTYiDtEJoEWR5Li6GXFiT45oniBQLc5sDo5I8Uy312t0&s=10',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSd8ZPMcEW975dlCTX_HBfUhhoUO8ibepus7BiXcuWmezo9nFcH_315tHI&s=10',
  ],
  'Iceland & Norway: Ring Road to the Fjords': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Seljalandsfoss%2C_Su%C3%B0urland%2C_Islandia%2C_2014-08-16%2C_DD_201-203_HDR.JPG/1920px-Seljalandsfoss%2C_Su%C3%B0urland%2C_Islandia%2C_2014-08-16%2C_DD_201-203_HDR.JPG',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Fiordo_de_Geiranger_desde_Flydalsjuvet%2C_Noruega%2C_2019-09-07%2C_DD_59.jpg/1920px-Fiordo_de_Geiranger_desde_Flydalsjuvet%2C_Noruega%2C_2019-09-07%2C_DD_59.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/J%C3%B6kuls%C3%A1rl%C3%B3n_glacier_lagoon%2C_Iceland%2C_20240719_1141_2541.jpg/1920px-J%C3%B6kuls%C3%A1rl%C3%B3n_glacier_lagoon%2C_Iceland%2C_20240719_1141_2541.jpg',
  ],
  'Central Europe: Prague to Budapest': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Castillo_de_Praga%2C_Praga%2C_Rep%C3%BAblica_Checa%2C_2022-07-01%2C_DD_23-25_HDR.jpg/1920px-Castillo_de_Praga%2C_Praga%2C_Rep%C3%BAblica_Checa%2C_2022-07-01%2C_DD_23-25_HDR.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Charles_Bridge_during_a_pink_sunrise_in_Prague.jpg/1920px-Charles_Bridge_during_a_pink_sunrise_in_Prague.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Budapest_Parliament_Building_At_Night.jpg/1920px-Budapest_Parliament_Building_At_Night.jpg',
  ],
  'Portugal: Lisbon, Évora & Porto': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/A_vibrant_panorama_of_Porto%2C_Portugal%2C_showcasing_the_Douro_River%2C_historic_Ribeira_district%2C_and_the_Dom_Lu%C3%ADs_I_Bridge._%2855247151390%29.jpg/1920px-A_vibrant_panorama_of_Porto%2C_Portugal%2C_showcasing_the_Douro_River%2C_historic_Ribeira_district%2C_and_the_Dom_Lu%C3%ADs_I_Bridge._%2855247151390%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Torre_de_Bel%C3%A9m_por_Rodrigo_Tetsuo_Argenton_%282%29.jpg/1920px-Torre_de_Bel%C3%A9m_por_Rodrigo_Tetsuo_Argenton_%282%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/No_28_Tram_%2845684287331%29.jpg/1920px-No_28_Tram_%2845684287331%29.jpg',
  ],
  'Guatemala: Antigua, Acatenango & Atitlán': [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGwLW1g03wtGrCgQ0wxLUdVRqcfINkhcp750pL3zYQS1Nb1Hacgcf2-uI&s=10',
  ],
  'Canadian Rockies: Banff to Jasper': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Moraine_Lake_17092005.jpg/1920px-Moraine_Lake_17092005.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Lake_Louise_and_Victoria_Glacier.jpg/1920px-Lake_Louise_and_Victoria_Glacier.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Panorama_of_Peyto_Lake%2C_Banff_National_Park%2C_Alberta%2C_Canada.jpg/1920px-Panorama_of_Peyto_Lake%2C_Banff_National_Park%2C_Alberta%2C_Canada.jpg',
  ],
  'Northern China: Beijing to Xi\'an': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/67054-The-Great-Wall%2C_Mutianyu.jpg/1920px-67054-The-Great-Wall%2C_Mutianyu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Terracotta_Army%2C_View_of_Pit_1.jpg/1920px-Terracotta_Army%2C_View_of_Pit_1.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Beijing_China_Forbidden-City-03.jpg/1920px-Beijing_China_Forbidden-City-03.jpg',
  ],
  'Silk Road: Xi\'an to Kashgar': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Terracotta_Army-China.jpg/1920px-Terracotta_Army-China.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Zhangye_Danxia_2016.jpg/1920px-Zhangye_Danxia_2016.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Karakul_Lake_-_Muztag_Ata%2C_China.jpg/1920px-Karakul_Lake_-_Muztag_Ata%2C_China.jpg',
  ],
  'Southwest China: Chengdu to Shangri-La': [
    'https://upload.wikimedia.org/wikipedia/commons/5/54/Chengdu-pandas-d10.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/20260223_Dali_Chongsheng_Temple_Pagoda_and_Erhai_Lake_01.jpg/1920px-20260223_Dali_Chongsheng_Temple_Pagoda_and_Erhai_Lake_01.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Lijiang_Yunnan_China_Jade-Dragon-Snow-Mountain-01.jpg/1920px-Lijiang_Yunnan_China_Jade-Dragon-Snow-Mountain-01.jpg',
  ],
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
  'South India: Tamil Nadu & Karnataka': [
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Brihadisvara_Temple_during_Maha_Shivaratri-WUS03611_%28edit%29.jpg/1920px-Brihadisvara_Temple_during_Maha_Shivaratri-WUS03611_%28edit%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Complex_of_Virupaksha_Temple%2C_Hampi_%2801%29.jpg/1920px-Complex_of_Virupaksha_Temple%2C_Hampi_%2801%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Gopuram_of_the_Meenakshi_Temple_at_Madurai.jpg/1920px-Gopuram_of_the_Meenakshi_Temple_at_Madurai.jpg',
  ],
}

function tripCovers(trip: DashboardTrip): string[] {
  const curated = DEFAULT_TRIP_COVERS[trip.title]
  if (curated && curated.length > 1) return [...new Set([trip.cover_image, ...curated].filter((url): url is string => !!url))]
  return trip.cover_image ? [trip.cover_image] : curated || (trip.trip_preview_image ? [trip.trip_preview_image] : [])
}

/** Per-trip cover crop focus. Lower Y % keeps landmark-heavy top of the photo visible above card title. */
const COVER_OBJECT_POSITION: Record<string, string> = {
  'Central Asia: Kazakhstan, Kyrgyzstan & Uzbekistan': 'center 30%',
  'Southeast Asia: Thailand, Cambodia & Vietnam': 'center 28%',
  'Greece & the Balkans: Athens to Sarajevo': 'center 28%',
  'Japan: Tokyo, Kyoto, Osaka & Kanazawa': 'center 30%',
  'Morocco & Tunisia: Sahara to Carthage': 'center 32%',
  'Iceland & Norway: Ring Road to the Fjords': 'center 30%',
  'Central Europe: Prague to Budapest': 'center 30%',
  'Portugal: Lisbon, Évora & Porto': 'center 28%',
  'Guatemala: Antigua, Acatenango & Atitlán': 'center 72%',
  'Canadian Rockies: Banff to Jasper': 'center 28%',
  'Northern China: Beijing to Xi\'an': 'center 32%',
  'Silk Road: Xi\'an to Kashgar': 'center 28%',
  'Southwest China: Chengdu to Shangri-La': 'center 34%',
  'South Korea: Seoul to Busan': 'center 28%',
  'Andes Triangle: Colombia, Ecuador & Bolivia': 'center 30%',
  'South India: Tamil Nadu & Karnataka': 'center 28%',
  'Mexico: CDMX, Oaxaca, Palenque & Yucatán': 'center 28%',
  'Lebanon & Cyprus: Phoenician Coast to Troodos': 'center 28%',
  'India: Delhi to Ellora': 'center 28%',
  'Sri Lanka: Kingdoms, Highlands & Coast': 'center 32%',
  'Pakistan: Indus Valley to Hunza': 'center 28%',
  'Southern Africa: Cape Town to Victoria Falls': 'center 58%',
}

function CoverImages({ images, className, isHovered, fallback, objectPosition }: {
  images: string[]; className: string; isHovered: boolean; fallback: string; objectPosition?: string
}): React.ReactElement {
  const [active, setActive] = useState(0)
  const [retry, setRetry] = useState(0)
  const imgStyle = objectPosition ? { objectPosition } : undefined
  useEffect(() => {
    const retryFailedImages = () => setRetry(value => value + 1)
    window.addEventListener('online', retryFailedImages)
    return () => window.removeEventListener('online', retryFailedImages)
  }, [])
  const hideFailedImage = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = 'none'
  }
  useEffect(() => {
    if (!isHovered || images.length <= 1) return
    const timer = window.setTimeout(() => setActive((active + 1) % images.length), 1500)
    return () => window.clearTimeout(timer)
  }, [active, isHovered, images.length])
  if (images.length <= 1) return <img key={retry} className={className} src={images[0]} alt="" style={imgStyle} onError={hideFailedImage} />
  const show = (index: number) => setActive((index + images.length) % images.length)
  return (
    <div className={`${className} cover-carousel`} style={{ background: fallback }}>
      {images.map((src, index) => <img key={`${src}-${retry}`} className={`cover-carousel-slide${index === active ? ' active' : ''}`} src={src} alt="" style={imgStyle} onError={hideFailedImage} />)}      {images[active]?.includes('upload.wikimedia.org/wikipedia/commons/4/49/Portland_HeadLight') && (
        <a className="cover-carousel-credit" href="https://commons.wikimedia.org/wiki/File:Portland_HeadLight_(cropped).jpg" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
          Giabar · CC BY-SA 3.0
        </a>
      )}
      <div className="cover-carousel-dots">
        {images.map((src, index) => (
          <button key={src} type="button" aria-label={`Show cover ${index + 1}`} aria-pressed={index === active}
            className={`cover-carousel-dot${index === active ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); show(index) }} />
        ))}
      </div>
      <div className="cover-carousel-arrows">
        <button type="button" aria-label="Previous cover image" className="cover-carousel-arrow"
          onClick={e => { e.stopPropagation(); show(active - 1) }}><ChevronLeft size={18} /></button>
        <button type="button" aria-label="Next cover image" className="cover-carousel-arrow"
          onClick={e => { e.stopPropagation(); show(active + 1) }}><ChevronRight size={18} /></button>
      </div>
    </div>
  )
}

function tripGradient(id: number): string { return entityGradient(id) }

// Day + short month for the boarding pass / cards, plus the year — but only
// when it isn't the current year (this year's trips stay clutter-free), e.g.
// { d: '10', m: 'Sep', y: '' } now vs { …, y: '2024' } for an older trip.
function splitDate(dateStr: string | null | undefined, locale: string): { d: string; m: string; y: string } | null {
  if (!dateStr) return null
  const date = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(date.getTime())) return null // malformed date — render a dash, never crash
  const otherYear = date.getUTCFullYear() !== new Date().getUTCFullYear()
  return {
    d: date.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' }),
    m: date.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
    y: otherYear ? date.toLocaleDateString(locale, { year: 'numeric', timeZone: 'UTC' }) : '',
  }
}

// Localized date for the cards. The year is included only when it isn't the
// current year, and order/punctuation follow the locale (EN "Sep 10, 2026",
// DE "10. Sep 2026" — vs a plain "Sep 10" this year), never a hard-coded layout.
function fullDate(dateStr: string | null | undefined, locale: string): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(date.getTime())) return null
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' }
  if (date.getUTCFullYear() !== new Date().getUTCFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString(locale, opts)
}

function buddyColor(seed: number): string {
  const pairs = [
    ['#6366f1', '#8b5cf6'], ['#10b981', '#059669'], ['#f59e0b', '#d97706'],
    ['#ec4899', '#be185d'], ['#0ea5e9', '#2563eb'], ['#14b8a6', '#0d9488'],
  ]
  const [a, b] = pairs[seed % pairs.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const RES_ICON: Record<string, React.ReactElement> = {
  flight: <AnimatedAirplaneIcon size={16} animate="hover" />, hotel: <Hotel size={16} />, restaurant: <Utensils size={16} />,
}
const RES_TYPE_CLASS: Record<string, string> = { flight: 'flight', hotel: 'hotel', restaurant: 'food' }

// Mobile gets a different boarding-pass treatment (separate card under the hero).
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export default function DashboardPage(): React.ReactElement {
  // Page = wiring container: all state, data loading and mutations live in the
  // useDashboard data hook; this component only renders what it returns.
  const {
    demoMode, locale, t, navigate,
    spotlight, heroBundle, stats, upcoming, recentActivity, gridTrips, isLoading,
    loadError, retryLoad,
    tripFilter, setTripFilter, viewMode, selectViewMode,
    completedSort, setCompletedSort, canReorder,
    showForm, setShowForm, editingTrip, setEditingTrip,
    deleteTrip, setDeleteTrip, copyTrip, setCopyTrip, setTrips,
    handleCreate, handleUpdate, confirmDelete, handleArchive, handleUnarchive, confirmCopy,
    handleReorderGrid,
    allSubOpen, setAllSubOpen,
  } = useDashboard()

  // Per-device dashboard widget visibility (from the appearance config).
  const isMobile = useIsMobile()
  const [arrangeMode, setArrangeMode] = useState(false)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [draftOrder, setDraftOrder] = useState<number[] | null>(null)
  const [lift, setLift] = useState<LiftState | null>(null)
  const overIndexRef = useRef<number | null>(null)
  const suppressOpenRef = useRef(false)
  const arrangedTrips = draftOrder
    ? draftOrder.map(id => gridTrips.find(trip => trip.id === id)).filter((trip): trip is DashboardTrip => !!trip)
    : gridTrips
  const liftedTrip = lift ? arrangedTrips.find(trip => trip.id === lift.tripId) ?? null : null

  const completedSortOptions: { value: CompletedSortKey; label: string }[] = [
    { value: 'date-desc', label: t('dashboard.sort.dateDesc') },
    { value: 'date-asc', label: t('dashboard.sort.dateAsc') },
    { value: 'duration-desc', label: t('dashboard.sort.durationDesc') },
    { value: 'duration-asc', label: t('dashboard.sort.durationAsc') },
    { value: 'places-desc', label: t('dashboard.sort.placesDesc') },
    { value: 'places-asc', label: t('dashboard.sort.placesAsc') },
  ]

  const exitArrangeMode = () => {
    setArrangeMode(false)
    setOverIndex(null)
    setDraftOrder(null)
    setLift(null)
    overIndexRef.current = null
  }

  useEffect(() => { exitArrangeMode() }, [tripFilter])

  useEffect(() => {
    if (!arrangeMode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exitArrangeMode() }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      // Stay in arrange mode while interacting with trip cards (or the floating ghost).
      if (target.closest('[data-trip-index], .trip-drag-ghost')) return
      exitArrangeMode()
    }
    window.addEventListener('keydown', onKey)
    // Defer so the releasing pointer from a long-press doesn't immediately clear arrange mode.
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown, true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [arrangeMode])
  const appearanceCfg = useSettingsStore(s => s.settings.appearance)
  const dashCfg = normalizeAppearance(appearanceCfg).dashboard
  const sideWidgets = isMobile ? dashCfg.mobile : dashCfg.desktop
  const showCurrency = sideWidgets.currency
  const showTimezones = sideWidgets.timezones
  const showUpcoming = sideWidgets.upcomingReservations
  const today = new Date().toISOString().slice(0, 10)
  const weatherPlace = heroBundle?.places.find(p => p.lat != null && p.lng != null)
  const [destinationCountryCode, setDestinationCountryCode] = useState<string | null>(null)
  useEffect(() => {
    if (weatherPlace?.lat == null || weatherPlace.lng == null) { setDestinationCountryCode(null); return }
    let cancelled = false
    setDestinationCountryCode(null)
    mapsApi.reverse(weatherPlace.lat, weatherPlace.lng, locale)
      .then(result => { if (!cancelled) setDestinationCountryCode(result.country_code || null) })
      .catch(() => { if (!cancelled) setDestinationCountryCode(null) })
    return () => { cancelled = true }
  }, [weatherPlace?.id, weatherPlace?.lat, weatherPlace?.lng, locale])
  const tripCurrency = currencyForCountryCode(destinationCountryCode) || spotlight?.currency
  const showWeather = !!spotlight?.start_date && spotlight.start_date >= today && !!weatherPlace
  // Collections is double-gated: the admin addon AND the per-user widget flag.
  const isAddonEnabled = useAddonStore(s => s.isEnabled)
  const showCollections = isAddonEnabled('collections') && sideWidgets.collections
  // Desktop has a master toggle for the whole right column; off → centered layout.
  // Only true dashboard widgets belong here — hero mounts on the boarding pass, and
  // place-detail/day-detail widgets live inside the planner panels, not the sidebar.
  const widgetPlugins = usePluginStore(s => s.plugins).filter(p => p.type === 'widget' && p.slot !== 'hero' && p.slot !== 'place-detail' && p.slot !== 'day-detail' && p.slot !== 'reservation-detail')
  const sidebarVisible = (isMobile || dashCfg.desktop.sidebar) && (showCurrency || showWeather || showCollections || showTimezones || showUpcoming || widgetPlugins.length > 0)

  // Plugin-contributed badges on the trip cards (tripCardProvider hook). One fetch for
  // all visible cards; only runs when at least one plugin is active. Fail-safe.
  const anyPluginActive = usePluginStore(s => s.plugins).length > 0
  const badgesFor = useTripCardBadges(gridTrips.map(t => t.id), anyPluginActive)

  return (
    <>
      {/* Navbar lives outside .trek-dash so it keeps the app-wide font + button
          styling instead of inheriting the dashboard scope's font and the
          `.trek-dash button` reset (which shifted the bell icon + menu items). */}
      <Navbar />
      <div className="trek-dash trek-dash-shell">
      {demoMode && <DemoBanner />}
      <div className="trek-dash-scroll">
        <MobileTopBar />
        <main className="page" data-no-sidebar={sidebarVisible ? undefined : 'true'} data-season-view={viewMode === 'seasons' && tripFilter === 'planned' ? 'true' : undefined}>
          <div className="page-main">
            {loadError && (
              <div className="dash-error" role="alert">
                <span className="dash-error-txt">{t('dashboard.loadErrorBanner')}</span>
                <button className="dash-error-retry" onClick={retryLoad}>
                  <AnimatedRefreshCwIcon size={15} />
                  {t('dashboard.retry')}
                </button>
              </div>
            )}
            {isLoading && !spotlight && !(viewMode === 'seasons' && tripFilter === 'planned') && (
              <>
                <section className="hero-trip dash-hero-skeleton" aria-hidden="true">
                  <span className="hero-skeleton-badge trek-skeleton" />
                  <span className="hero-skeleton-title trek-skeleton" />
                  {!isMobile && (
                    <div className="hero-skeleton-pass">
                      {Array.from({ length: 4 }, (_, index) => <span className="trek-skeleton" key={index} />)}
                    </div>
                  )}
                </section>
                {isMobile && (
                  <section className="pass-card dash-pass-skeleton" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div className="pass-cell" key={index}>
                        <span className="trek-skeleton" />
                        <span className="trek-skeleton" />
                          <span className="trek-skeleton" />
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
            {spotlight && (
              <BoardingPassHero
                trip={spotlight}
                bundle={heroBundle}
                locale={locale}
                href={`/trips/${spotlight.id}`}
                onOpen={() => navigate(`/trips/${spotlight.id}`)}
                onEdit={() => { setEditingTrip(spotlight); setShowForm(true) }}
                onCopy={() => setCopyTrip(spotlight)}
                onArchive={() => spotlight.is_archived ? handleUnarchive(spotlight.id) : handleArchive(spotlight.id)}
                onDelete={() => setDeleteTrip(spotlight)}
              />
            )}

            <AtlasStats stats={stats} />

            <section className="dashboard-trip-list">
              <div className="sec-head">
                <h3 className="sec-title">{t('dashboard.title')}</h3>
                <div className="sec-tools">
                  {tripFilter === 'completed' && gridTrips.length > 1 && (
                    <div className="trip-sort" role="group" aria-label={t('dashboard.sort.label')}>
                      <CustomSelect
                        value={completedSort}
                        onChange={(v) => setCompletedSort(v as CompletedSortKey)}
                        options={completedSortOptions}
                        size="sm"
                      />
                    </div>
                  )}
                  <div className="seg" role="tablist" aria-label={t('dashboard.title')}>
                    <button type="button" role="tab" aria-selected={tripFilter === 'planned'} className={tripFilter === 'planned' ? 'on' : ''} onClick={() => setTripFilter('planned')}>{t('dashboard.filter.planned')}</button>
                    <button type="button" role="tab" aria-selected={tripFilter === 'archive'} className={tripFilter === 'archive' ? 'on' : ''} onClick={() => setTripFilter('archive')}>{t('dashboard.archived')}</button>
                    <button type="button" role="tab" aria-selected={tripFilter === 'completed'} className={tripFilter === 'completed' ? 'on' : ''} onClick={() => setTripFilter('completed')}>{t('dashboard.mobile.completed')}</button>
                  </div>
                  <button
                    className="tool-action"
                    aria-label="Subscribe to all trips calendar"
                    title="Subscribe to all trips"
                    onClick={() => setAllSubOpen(true)}
                    style={{ width: 38, height: 38, borderRadius: 11 }}
                  >
                    <CalendarPlus size={17} />
                  </button>
                  <div className="seg trip-view-select" role="group" aria-label="Trip view">
                    <button type="button" aria-pressed={viewMode === 'grid'} onClick={() => selectViewMode('grid')}><LayoutGrid size={15} />Grid</button>
                    <button type="button" aria-pressed={viewMode === 'list'} onClick={() => selectViewMode('list')}><List size={15} />List</button>
                    {tripFilter === 'planned' && <button type="button" aria-pressed={viewMode === 'seasons'} onClick={() => selectViewMode('seasons')}>Seasons</button>}
                  </div>
                </div>
              </div>
              {allSubOpen && (
                <IcsSubscribeModal
                  endpoint="/api/feed/user"
                  title="Subscribe to all trips"
                  description="One calendar feed for all your active trips, kept in sync automatically. Excludes archived trips and trips that ended more than 90 days ago."
                  onClose={() => setAllSubOpen(false)}
                />
              )}

              {!isLoading && !loadError && arrangedTrips.length === 0 && tripFilter === 'archive' && (
                <div className="trips-empty">
                  <h4>{t('dashboard.emptyArchivedTitle')}</h4>
                  <p>{t('dashboard.emptyArchivedText')}</p>
                </div>
              )}
              {!isLoading && !loadError && arrangedTrips.length === 0 && tripFilter === 'completed' && (
                <div className="trips-empty">
                  <h4>{t('dashboard.emptyCompletedTitle')}</h4>
                  <p>{t('dashboard.emptyCompletedText')}</p>
                </div>
              )}
              {!isLoading && !loadError && arrangedTrips.length === 0 && tripFilter === 'planned' && !spotlight && (
                <div className="trips-empty">
                  <h4>{t('dashboard.emptyTitle')}</h4>
                  <p>{t('dashboard.emptyText')}</p>
                </div>
              )}

              {isLoading && <div className="sr-only" role="status">{t('dashboard.subtitle.loading')}</div>}
              {viewMode === 'seasons' && tripFilter === 'planned' ? (
                <TripSeasonsView trips={[...(spotlight ? [spotlight] : []), ...gridTrips.filter(trip => trip.id !== spotlight?.id)]} onOpen={id => navigate(`/trips/${id}`)} />
              ) : viewMode !== 'seasons' || tripFilter !== 'planned' ? (
              <div
                className={`trips${viewMode === 'list' ? ' list-view' : ''}${canReorder && arrangedTrips.length > 1 ? ' trips-reorderable' : ''}${arrangeMode ? ' is-arranging' : ''}`}
                aria-busy={isLoading}
              >
                {isLoading && arrangedTrips.length === 0 && Array.from({ length: 3 }, (_, index) => (
                  <article className="trip-card trip-card-skeleton" key={`loading-${index}`} aria-hidden="true">
                    <div className="trip-cover trek-skeleton">
                      <div className="trip-cover-content"><div className="trip-skeleton-title trek-skeleton" /></div>
                    </div>
                    <div className="trip-body">
                      <div className="trip-dates"><span className="trip-skeleton-date trek-skeleton" /></div>
                      <div className="trip-meta" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        {Array.from({ length: 3 }, (_, cell) => (
                          <span className="trip-skeleton-meta-cell" key={cell}>
                            <span className="trek-skeleton" />
                            <span className="trek-skeleton" />
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
                {arrangedTrips.map((trip, index) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    index={index}
                    locale={locale}
                    badges={badgesFor(trip.id)}
                    href={`/trips/${trip.id}`}
                    onOpen={() => navigate(`/trips/${trip.id}`)}
                    onEdit={() => { setEditingTrip(trip); setShowForm(true) }}
                    onCopy={() => setCopyTrip(trip)}
                    onArchive={() => trip.is_archived ? handleUnarchive(trip.id) : handleArchive(trip.id)}
                    onDelete={() => setDeleteTrip(trip)}
                    reorderable={canReorder && arrangedTrips.length > 1}
                    arrangeMode={arrangeMode}
                    dragging={lift?.tripId === trip.id}
                    dragOver={overIndex === index && lift != null && lift.tripId !== trip.id}
                    onArrangePointerDown={(e) => {
                      if (!canReorder || arrangedTrips.length < 2 || e.button !== 0) return
                      if (e.target instanceof Element && e.target.closest('button, a, [role="button"]')) return

                      const cardEl = e.currentTarget
                      const startX = e.clientX
                      const startY = e.clientY
                      let from = index
                      let order = (draftOrder ?? arrangedTrips.map(item => item.id)).slice()
                      let armed = arrangeMode
                      let lifted = false
                      let holdTimer: number | null = null
                      let didReorder = false
                      let originLeft = 0
                      let originTop = 0
                      let cardWidth = 0
                      let cardHeight = 0
                      const tripId = trip.id

                      const setOver = (next: number | null) => {
                        overIndexRef.current = next
                        setOverIndex(next)
                      }

                      const hitIndex = (clientX: number, clientY: number): number | null => {
                        const stack = document.elementsFromPoint(clientX, clientY)
                        for (const el of stack) {
                          if (!(el instanceof Element)) continue
                          if (el.closest('.trip-drag-ghost')) continue
                          const card = el.closest('[data-trip-index]')
                          if (!card) continue
                          const to = Number(card.getAttribute('data-trip-index'))
                          return Number.isFinite(to) ? to : null
                        }
                        return null
                      }

                      const beginLift = () => {
                        if (lifted) return
                        const rect = cardEl.getBoundingClientRect()
                        originLeft = rect.left
                        originTop = rect.top
                        cardWidth = rect.width
                        cardHeight = rect.height
                        lifted = true
                        setLift({
                          tripId,
                          index: from,
                          width: cardWidth,
                          height: cardHeight,
                          originLeft,
                          originTop,
                          dx: 0,
                          dy: 0,
                        })
                      }

                      const armArrange = () => {
                        armed = true
                        suppressOpenRef.current = true
                        setArrangeMode(true)
                        setDraftOrder(order.slice())
                        setOver(from)
                        try { navigator.vibrate?.(12) } catch { /* optional */ }
                      }

                      if (arrangeMode) {
                        suppressOpenRef.current = true
                        setOver(from)
                      } else {
                        holdTimer = window.setTimeout(armArrange, ARRANGE_HOLD_MS)
                      }

                      const onMove = (ev: PointerEvent) => {
                        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY)
                        if (!armed && dist > ARRANGE_MOVE_CANCEL_PX) {
                          if (holdTimer != null) window.clearTimeout(holdTimer)
                          holdTimer = null
                          cleanup()
                          return
                        }
                        if (!armed) return
                        ev.preventDefault()
                        if (!lifted && dist >= ARRANGE_LIFT_PX) beginLift()
                        if (lifted) {
                          const dx = ev.clientX - startX
                          const dy = ev.clientY - startY
                          setLift(prev => prev && prev.tripId === tripId
                            ? { ...prev, dx, dy, index: from }
                            : prev)
                        }
                        const to = hitIndex(ev.clientX, ev.clientY)
                        if (to == null || to === from) return
                        order = moveTripId(order, from, to)
                        from = to
                        didReorder = true
                        setDraftOrder(order.slice())
                        setOver(from)
                        setLift(prev => prev && prev.tripId === tripId ? { ...prev, index: from } : prev)
                      }

                      const onUp = () => {
                        if (holdTimer != null) window.clearTimeout(holdTimer)
                        setLift(null)
                        setOver(null)
                        cleanup()
                        if (didReorder) {
                          setDraftOrder(null)
                          void handleReorderGrid(order)
                        }
                        if (armed || didReorder) {
                          suppressOpenRef.current = true
                          window.setTimeout(() => { suppressOpenRef.current = false }, 0)
                        }
                      }

                      const cleanup = () => {
                        window.removeEventListener('pointermove', onMove)
                        window.removeEventListener('pointerup', onUp)
                        window.removeEventListener('pointercancel', onUp)
                      }

                      window.addEventListener('pointermove', onMove, { passive: false })
                      window.addEventListener('pointerup', onUp)
                      window.addEventListener('pointercancel', onUp)
                    }}
                    suppressOpen={() => {
                      if (suppressOpenRef.current || arrangeMode) {
                        suppressOpenRef.current = false
                        return true
                      }
                      return false
                    }}
                  />
                ))}
                {tripFilter === 'planned' && !isLoading && (
                  <button className="add-trip-card" onClick={() => { setEditingTrip(null); setShowForm(true) }}>
                    <div>
                      <div className="circ"><Plus size={20} /></div>
                      <div className="ttl">{t('dashboard.newTrip')}</div>
                      <div className="sub">{t('dashboard.newTripSub')}</div>
                    </div>
                  </button>
                )}
              </div>
              ) : null}
              {lift && liftedTrip && (
                <div
                  className="trip-drag-ghost"
                  style={{
                    left: lift.originLeft + lift.dx,
                    top: lift.originTop + lift.dy,
                    width: lift.width,
                  }}
                  aria-hidden="true"
                >
                  <TripCard
                    trip={liftedTrip}
                    index={lift.index}
                    locale={locale}
                    badges={badgesFor(liftedTrip.id)}
                    href={`/trips/${liftedTrip.id}`}
                    onOpen={() => {}}
                    onEdit={() => {}}
                    onCopy={() => {}}
                    onArchive={() => {}}
                    onDelete={() => {}}
                    floating
                  />
                </div>
              )}
            </section>

            {recentActivity.length > 0 && (
              <section className="recent-activity" aria-labelledby="recent-activity-title">
                <div className="sec-head">
                  <h3 className="sec-title" id="recent-activity-title">Recent activity</h3>
                </div>
                <div className="recent-activity-list">
                  {recentActivity.map(item => (
                    <button key={`${item.entity_type}-${item.entity_id}`} className="recent-activity-row" onClick={() => navigate(`/trips/${item.trip_id}`)}>
                      <span className="recent-activity-copy">
                        <span className="recent-activity-title">{item.entity_type === 'trip' || item.entity_type === 'trip_updated' ? item.trip_title : item.item_title}</span>
                        <span className="recent-activity-sub">{item.entity_type === 'trip' ? 'Trip created' : item.entity_type === 'trip_updated' ? 'Trip updated' : `${item.entity_type === 'place_added' ? 'Added to' : 'Updated in'} ${item.trip_title}`}</span>
                      </span>
                      <span className="recent-activity-date">{new Date(item.activity_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {sidebarVisible && (
            <aside className="page-sidebar">
              {showCurrency && <CurrencyTool tripCurrency={tripCurrency} tripTitle={spotlight?.title} />}
              {showWeather && weatherPlace && spotlight?.start_date && <WeatherTool place={weatherPlace} date={spotlight.start_date} locale={locale} />}
              {showTimezones && <TimezoneTool locale={locale} />}
              {showUpcoming && <UpcomingTool items={upcoming} locale={locale} onOpen={(tripId) => navigate(`/trips/${tripId}`)} />}
              {showCollections && <CollectionsWidget onOpen={() => navigate('/collections')} />}
              <PluginWidgets plugins={widgetPlugins} tripId={spotlight ? String(spotlight.id) : null} />
            </aside>
          )}
        </main>
      </div>

      {showForm && (
        <TripFormModal
          isOpen={showForm}
          trip={editingTrip}
          onClose={() => { setShowForm(false); setEditingTrip(null) }}
          onSave={editingTrip ? handleUpdate : handleCreate}
          onCoverUpdate={(tripId, coverUrl) => setTrips(prev => prev.map(t => t.id === tripId ? { ...t, cover_image: coverUrl } : t))}
        />
      )}
      {deleteTrip && (
        <ConfirmDialog
          isOpen={!!deleteTrip}
          title={t('common.delete')}
          message={t('dashboard.confirm.delete', { title: deleteTrip.title })}
          confirmLabel={t('common.delete')}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTrip(null)}
          danger
        />
      )}
      {copyTrip && (
        <CopyTripDialog
          isOpen={!!copyTrip}
          tripTitle={copyTrip.title}
          onConfirm={confirmCopy}
          onClose={() => setCopyTrip(null)}
        />
      )}
      </div>
    </>
  )
}

function openCard(e: React.MouseEvent, href: string, onOpen: () => void): void {
  if (e.target instanceof Element && e.target.closest('button, a, [role="button"]')) return
  if (e.metaKey || e.ctrlKey) {
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }
  onOpen()
}

// ── Boarding-pass hero ───────────────────────────────────────────────────────
function BoardingPassHero({ trip, bundle, locale, href, onOpen, onEdit, onCopy, onArchive, onDelete }: {
  trip: DashboardTrip; bundle: HeroBundle | null; locale: string; href: string; onOpen: () => void
  onEdit: () => void; onCopy: () => void; onArchive: () => void; onDelete: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  const [isHovered, setIsHovered] = useState(false)
  const covers = tripCovers(trip)
  const mobile = useIsMobile()
  const heroPlugins = usePluginStore(s => s.plugins).filter(p => p.type === 'widget' && p.slot === 'hero')
  const stop = (e: React.MouseEvent, fn: () => void) => { e.stopPropagation(); fn() }
  const status = getTripStatus(trip)
  const start = splitDate(trip.start_date, locale)
  const end = splitDate(trip.end_date, locale)

  // Countdown cell — plain text in the same style as the trip-dates cell:
  // days remaining while the trip runs, days until departure before it starts.
  const until = daysUntil(trip.start_date)
  const ongoing = status === 'ongoing'
  let countdownTop = ''
  let countdownNumber = ''
  let countdownLabel = ''
  if (ongoing && trip.end_date) {
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
    const endMid = new Date(trip.end_date + 'T00:00:00')
    const daysLeft = Math.max(0, Math.round((endMid.getTime() - todayMid.getTime()) / MS_PER_DAY))
    countdownTop = t('dashboard.status.ongoing')
    countdownNumber = String(daysLeft)
    countdownLabel = daysLeft === 0 ? t('dashboard.hero.lastDay') : daysLeft === 1 ? t('dashboard.hero.dayLeft') : t('dashboard.hero.daysLeft')
  } else if (until !== null && until >= 0) {
    countdownTop = t('dashboard.hero.startsIn')
    countdownNumber = String(until)
    countdownLabel = until === 1 ? t('dashboard.hero.dayUnitOne') : t('dashboard.hero.dayUnitMany')
  }

  const members = bundle?.members || []
  const places = bundle?.places || []
  const buddyCount = trip.shared_count != null ? trip.shared_count + 1 : members.length
  const placeCount = trip.place_count || places.length

  const badge = status === 'ongoing' ? t('dashboard.hero.badgeLive')
    : status === 'today' ? t('dashboard.hero.badgeToday')
    : status === 'tomorrow' ? t('dashboard.hero.badgeTomorrow')
    : status === 'future' ? t('dashboard.hero.badgeNext')
    : t('dashboard.hero.badgeRecent')

  const passCells = (
    <>
      <div className="pass-cell buddies">
        <div className="pass-label">{t('dashboard.members')}</div>
        <div className="buddies-avatars">
          {members.slice(0, 4).map((m, i) => (
            m.avatar_url
              ? <img key={m.id} className="buddy-avatar" src={m.avatar_url} alt={m.username} style={{ objectFit: 'cover' }} />
              : <div key={m.id} className="buddy-avatar" style={{ background: buddyColor(i) }}>{initials(m.username)}</div>
          ))}
          {members.length > 4 && <div className="buddy-more">+{members.length - 4}</div>}
          {members.length === 0 && <div className="buddy-avatar" style={{ background: buddyColor(0) }}>{initials(trip.owner_username)}</div>}
        </div>
        <div className="date-month">{buddyCount === 1 ? t('dashboard.hero.travelerOne', { count: buddyCount }) : t('dashboard.hero.travelerMany', { count: buddyCount })}</div>
      </div>

      <div className="pass-cell dates-combined">
        <div className="pass-label">{t('dashboard.hero.tripDates')}</div>
        <div className="dates-row">
          {start ? <div className="date-block"><div className="date-num mono">{start.d}</div><div className="date-month">{start.m}{start.y ? ` ${start.y}` : ''}</div></div>
            : <div className="date-block"><div className="date-num">—</div></div>}
          <div className="date-arrow"><ArrowRight /></div>
          {end ? <div className="date-block"><div className="date-num mono">{end.d}</div><div className="date-month">{end.m}{end.y ? ` ${end.y}` : ''}</div></div>
            : <div className="date-block"><div className="date-num">—</div></div>}
        </div>
      </div>

      <div className="pass-cell countdown">
        {countdownNumber && (
          <>
            <div className="pass-label">{countdownTop}</div>
            <div className="date-num mono">{countdownNumber}</div>
            <div className="date-month">{countdownLabel}</div>
          </>
        )}
      </div>

      <div className="pass-cell places">
        <div className="pass-label">{t('dashboard.places')}</div>
        <div className="places-preview">
          {places.slice(0, 3).map(p => (
            <div key={p.id} className="place-av">
              <PlaceAvatar place={p} size={mobile ? 24 : 32} category={{ name: p.category_name ?? p.category?.name ?? p.category_icon ?? p.category?.icon ?? undefined, color: p.category_color ?? p.category?.color ?? undefined, icon: p.category_icon ?? p.category?.icon ?? undefined }} />
            </div>
          ))}
          {places.length === 0 && <div className="place-more"><MapPin size={15} /></div>}
          {places.length > 3 && <div className="place-more">+{places.length - 3}</div>}
        </div>
        <div className="date-month">{placeCount === 1 ? t('dashboard.hero.destinationOne', { count: placeCount }) : t('dashboard.hero.destinationMany', { count: placeCount })}</div>
      </div>
    </>
  )

  return (
    <>
    <section className="hero-trip" style={{ background: tripGradient(trip.id) }} onClick={(e) => openCard(e, href, onOpen)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {covers.length
        ? <CoverImages images={covers} className="bg" isHovered={isHovered} fallback={tripGradient(trip.id)} objectPosition={COVER_OBJECT_POSITION[trip.title]} />
        : <div className="bg" style={{ background: tripGradient(trip.id) }} />}
      <div className="scrim" />
      <div className="hero-content">
        <div className="hero-top">
          <div className="hero-badge">
            {status === 'ongoing' && <span className="pulse" />}
            {badge}
          </div>
          <div className="hero-tools">
            <button className="hero-tool" aria-label={t('common.edit')} onClick={(e) => stop(e, onEdit)}><Edit2 size={16} /></button>
            <button className="hero-tool" aria-label={t('dashboard.aria.duplicate')} onClick={(e) => stop(e, onCopy)}><Copy size={16} /></button>
            <button className="hero-tool" aria-label={trip.is_archived ? t('dashboard.restore') : t('dashboard.archive')} onClick={(e) => stop(e, onArchive)}><Archive size={16} /></button>
            <button className="hero-tool" aria-label={t('common.delete')} onClick={(e) => stop(e, onDelete)}><Trash2 size={16} /></button>
          </div>
        </div>

        <div className="hero-title-block">
          <h2 className="hero-title">{trip.title}</h2>
        </div>

        {!mobile && (
          <div className="hero-pass-wrap">
            {heroPlugins.length > 0 && (
              <div className="hero-pass-overlay" aria-hidden="true">
                {heroPlugins.map(p => (
                  <PluginFrame key={p.id} pluginId={p.id} tripId={String(trip.id)} title={p.name} className="hero-overlay-frame" />
                ))}
              </div>
            )}
            <div className="hero-pass" onClick={(e) => { e.stopPropagation(); openCard(e, href, onOpen) }}>
              <div className="hero-pass-inner">{passCells}</div>
            </div>
          </div>
        )}
      </div>
    </section>
    {mobile && <section className="pass-card" onClick={(e) => openCard(e, href, onOpen)}>{passCells}</section>}
    </>
  )
}

// ── Atlas / stats row ────────────────────────────────────────────────────────
function formatCompactDistance(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  // String() keeps a '.' decimal regardless of locale (no "1,5k" in non-English UIs).
  if (safeValue >= 1000) {
    return `${String(Math.round(safeValue / 100) / 10)}k`
  }
  const rounded = Math.round(safeValue * 10) / 10
  if (safeValue > 0 && rounded === 0) return '<0.1'
  return String(rounded)
}

function AtlasStats({ stats }: { stats: TravelStats | null }): React.ReactElement | null {
  const { t } = useTranslation()
  const distanceUnit = useSettingsStore(s => s.settings.distance_unit) || 'metric'
  const appearance = useSettingsStore(s => s.settings.appearance)
  const isMobile = useIsMobile()
  const dash = normalizeAppearance(appearance).dashboard

  // Per-device widget visibility. Atlas + distance are desktop-only tiles.
  const showAtlas = !isMobile && dash.desktop.atlas
  const showTrips = isMobile ? dash.mobile.tripsTotal : dash.desktop.tripsTotal
  const showDays = isMobile ? dash.mobile.daysTraveled : dash.desktop.daysTraveled
  const showDistance = !isMobile && dash.desktop.distanceFlown
  if (!showAtlas && !showTrips && !showDays && !showDistance) return null

  // Reflow: the grid spreads the visible tiles to full width (the passport stays
  // proportionally wider). Set as CSS vars so the responsive media queries still win.
  const atlasTemplate =
    [dash.desktop.atlas && '1.5fr', dash.desktop.tripsTotal && '1fr', dash.desktop.daysTraveled && '1fr', dash.desktop.distanceFlown && '1fr']
      .filter(Boolean).join(' ') || '1fr'
  const atlasTemplateM =
    [dash.mobile.tripsTotal && '1fr', dash.mobile.daysTraveled && '1fr'].filter(Boolean).join(' ') || '1fr'

  const countries = stats
    ? [...new Set(['US', ...(stats.countries || []).filter(code => code !== 'US')])]
    : []
  const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const distanceKm = stats?.totalDistanceKm || 0
  const distance = convertDistance(distanceKm, distanceUnit)
  const distanceText = formatCompactDistance(distance)
  const equatorDistance = convertDistance(40075, distanceUnit)
  const equatorTimes = (distance / equatorDistance).toFixed(2)
  const equatorProgress = (distance % equatorDistance) / equatorDistance
  const equatorRingLength = 2 * Math.PI * 14
  const distanceLabel = getDistanceUnitLabel(distanceUnit)

  return (
    <section className="atlas" style={{ '--atlas-template': atlasTemplate, '--atlas-template-m': atlasTemplateM } as React.CSSProperties}>
      {showAtlas && (
        <div className="atlas-card passport">
          <div className="label">{t('dashboard.atlas.countriesVisited')}</div>
          <div className="value mono">{stats ? countries.length : '—'} {stats && <span className="unit text-[oklch(1_0_0_/_.55)]">{t('dashboard.atlas.ofTotal', { total: 195 })}</span>}</div>
          <div className="passport-flags">
            {stats && countries.slice(0, 5).map((c, i) => (
              <span key={c} className="flag" title={`${countryNames.of(c) || c} (${c})`}>
                <img src={`https://flagcdn.com/w40/${c.toLowerCase()}.png`} alt={countryNames.of(c) || c} loading="lazy" />
              </span>
            ))}
            {stats && countries.length > 5 && <span className="flag more">+{countries.length - 5}</span>}
          </div>
          <div className="delta" />
        </div>
      )}

      {showTrips && (
        <div className="atlas-card">
          <div className="label">{t('dashboard.atlas.tripsTotal')}</div>
          <div className="value mono">{stats?.totalTrips ?? '—'}</div>
          <div className="delta">{stats ? t('dashboard.atlas.placesMapped', { count: stats.totalPlaces ?? 0 }) : '—'}</div>
          <svg className="spark" width="80" height="36" viewBox="0 0 80 36">
            <polyline points="0,30 12,26 22,28 32,18 44,22 56,10 68,14 80,4" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {showDays && (
        <div className="atlas-card">
          <div className="label">{t('dashboard.atlas.daysTraveled')}</div>
          <div className="value mono">{stats ? <>{stats.totalDays ?? 0} <span className="unit">{t('dashboard.atlas.daysUnit')}</span></> : '—'}</div>
          <div className="delta">{t('dashboard.atlas.acrossAllTrips')}</div>
          <svg className="spark" width="80" height="36" viewBox="0 0 80 36">
            <path d="M0 30 Q10 24 20 26 T40 20 T60 14 T80 10" fill="none" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {showDistance && (
        <div className="atlas-card">
          <div className="label">{t('dashboard.atlas.distanceFlown')}</div>
          <div className="value mono">{stats ? <>{distanceText} <span className="unit">{distanceLabel}</span></> : '—'}</div>
          <div className="delta">{stats ? t('dashboard.atlas.aroundEquator', { count: equatorTimes }) : '—'}</div>
          <svg aria-hidden="true" className="spark" width="80" height="36" viewBox="0 0 80 36">
            <circle cx="40" cy="18" r="14" fill="none" stroke="oklch(0.88 0.01 70)" strokeWidth="2" />
            <circle cx="40" cy="18" r="14" fill="none" strokeWidth="2" strokeDasharray={`${equatorRingLength * equatorProgress} ${equatorRingLength}`} strokeLinecap="round" transform="rotate(-90 40 18)" />
          </svg>
        </div>
      )}
    </section>
  )
}

// ── Trip card ────────────────────────────────────────────────────────────────
function TripCard({ trip, index, locale, badges, href, onOpen, onEdit, onCopy, onArchive, onDelete,
  reorderable = false, arrangeMode = false, dragging = false, dragOver = false, floating = false,
  onArrangePointerDown, suppressOpen,
}: {
  trip: DashboardTrip; index: number; locale: string; badges?: TripCardBadge[]; href: string; onOpen: () => void
  onEdit: () => void; onCopy: () => void; onArchive: () => void; onDelete: () => void
  reorderable?: boolean
  arrangeMode?: boolean
  dragging?: boolean
  dragOver?: boolean
  floating?: boolean
  onArrangePointerDown?: (e: React.PointerEvent) => void
  suppressOpen?: () => boolean
}): React.ReactElement {
  const { t } = useTranslation()
  const [isHovered, setIsHovered] = useState(false)
  const covers = tripCovers(trip)
  const status = getTripStatus(trip)
  const start = splitDate(trip.start_date, locale)
  const end = splitDate(trip.end_date, locale)
  const until = daysUntil(trip.start_date)
  const approximateDate = trip.date_precision && trip.date_precision !== 'day' ? trip.date_label : null

  const statusClass = status === 'ongoing' ? '' : status === 'past' ? 'completed' : status === 'future' || status === 'today' || status === 'tomorrow' ? 'upcoming' : 'idea'
  const statusLabel = status === 'ongoing' ? t('dashboard.mobile.liveNow')
    : status === 'today' ? t('dashboard.status.today')
    : status === 'tomorrow' ? t('dashboard.status.tomorrow')
    : status === 'future' && until !== null ? (until > 60 ? t('dashboard.mobile.inMonths', { count: Math.round(until / 30) }) : t('dashboard.mobile.inDays', { count: until }))
    : status === 'past' ? t('dashboard.mobile.completed')
    : t('dashboard.card.idea')

  const stop = (e: React.MouseEvent, fn: () => void) => { e.stopPropagation(); fn() }

  return (
    <article
      className={`trip-card${dragging && !floating ? ' is-drag-placeholder' : ''}${dragOver ? ' is-drag-over' : ''}`}
      data-trip-index={floating ? undefined : index}
      aria-grabbed={dragging || undefined}
      title={!floating && reorderable && !arrangeMode ? t('dashboard.reorder.arrangeHint') : undefined}
      onClick={(e) => {
        if (floating) return
        if (suppressOpen?.()) return
        openCard(e, href, onOpen)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={!floating && reorderable ? onArrangePointerDown : undefined}
    >
      <div className="trip-cover" style={{ background: tripGradient(trip.id) }}>
        {covers.length
          ? <CoverImages images={covers} className="trip-cover-image" isHovered={isHovered && !arrangeMode} fallback={tripGradient(trip.id)} objectPosition={COVER_OBJECT_POSITION[trip.title]} />
          : <div style={{ width: '100%', height: '100%', background: tripGradient(trip.id) }} />}
        <div className={`trip-status ${statusClass}`}><span className="indicator" /> {statusLabel}</div>
        <div className="trip-actions">
          <button className="trip-action-btn" aria-label={t('common.edit')} onClick={(e) => stop(e, onEdit)}><Edit2 size={16} /></button>
          <button className="trip-action-btn" aria-label={t('dashboard.aria.duplicate')} onClick={(e) => stop(e, onCopy)}><Copy size={16} /></button>
          <button className="trip-action-btn" aria-label={trip.is_archived ? t('dashboard.restore') : t('dashboard.archive')} onClick={(e) => stop(e, onArchive)}><Archive size={16} /></button>
          <button className="trip-action-btn" aria-label={t('common.delete')} onClick={(e) => stop(e, onDelete)}><Trash2 size={16} /></button>
        </div>
        <div className="trip-cover-content">
          <h3 className="trip-name">{trip.title}</h3>
        </div>
      </div>
      <div className="trip-body">
        <div className="trip-dates">
          {approximateDate ? <span className="date-num">{approximateDate}</span> : start && end ? (
            <>
              <span className="date-num">{fullDate(trip.start_date, locale)}</span>
              <span className="date-arrow"><ArrowRight size={11} /></span>
              <span className="date-num">{fullDate(trip.end_date, locale)}</span>
            </>
          ) : <span className="date-num">{t('dashboard.hero.noDates')}</span>}
        </div>
        <div className="trip-meta" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div><span className="n mono">{trip.day_count ?? 0}</span><span className="k">{t('dashboard.days')}</span></div>
          <div><span className="n mono">{trip.place_count ?? 0}</span><span className="k">{t('dashboard.places')}</span></div>
          <div><span className="n mono">{trip.shared_count ?? 0}</span><span className="k">{trip.shared_count === 1 ? t('dashboard.card.buddyOne') : t('dashboard.members')}</span></div>
        </div>
        <TripCardBadges items={badges ?? []} />
      </div>
    </article>
  )
}

// ── Currency tool (self-contained, mirrors the design's fx widget) ───────────
function CurrencyTool({ tripCurrency, tripTitle }: { tripCurrency?: string; tripTitle?: string }): React.ReactElement {
  const { t } = useTranslation()
  const isLoaded = useSettingsStore(s => s.isLoaded)
  const updateSetting = useSettingsStore(s => s.updateSetting)
  const savedFrom = useSettingsStore(s => s.settings.dashboard_fx_from) || 'EUR'
  const to = useSettingsStore(s => s.settings.dashboard_fx_to) || 'USD'
  const [manualFrom, setManualFrom] = useState<string | null>(null)
  const from = manualFrom || tripCurrency || savedFrom
  useEffect(() => { setManualFrom(null) }, [tripCurrency, tripTitle])
  const setFrom = (v: string) => { setManualFrom(v); updateSetting('dashboard_fx_from', v).catch(() => {}) }
  const setTo = (v: string) => { updateSetting('dashboard_fx_to', v).catch(() => {}) }
  const [amount, setAmount] = useState('100')
  const [rates, setRates] = useState<Record<string, number> | null>(null)

  const fetchRate = React.useCallback(() => {
    fetch(`https://api.frankfurter.dev/v2/rates?base=${from}`)
      .then(r => r.json())
      .then((d: Array<{ quote: string; rate: number }>) => {
        if (!Array.isArray(d)) { setRates(null); return }
        // Frankfurter omits the base's own self-rate; seed it so `from` stays selectable.
        const map: Record<string, number> = { [from]: 1 }
        for (const r of d) map[r.quote] = r.rate
        setRates(map)
      })
      .catch(() => setRates(null))
  }, [from])

  useEffect(() => { fetchRate() }, [fetchRate])
  // One-time migration of the pre-3.1.3 localStorage values into the user's settings,
  // so a (docker) upgrade no longer resets the widget (#1311).
  useEffect(() => {
    if (!isLoaded) return
    const lf = localStorage.getItem('trek_fx_from')
    const lt = localStorage.getItem('trek_fx_to')
    if (!lf && !lt) return
    const writes: Promise<void>[] = []
    if (lf) writes.push(updateSetting('dashboard_fx_from', lf))
    if (lt) writes.push(updateSetting('dashboard_fx_to', lt))
    // Only drop the localStorage source once the server has durably stored the values, so a
    // failed write during a (docker) upgrade can't destroy the only copy (#1311). Retry next load.
    Promise.all(writes).then(() => {
      localStorage.removeItem('trek_fx_from')
      localStorage.removeItem('trek_fx_to')
    }).catch(() => { /* keep localStorage; retry on next load */ })
  }, [isLoaded, updateSetting])

  const currencies = [...new Set([...(rates ? Object.keys(rates) : CURRENCIES), from, to])].sort()
  const ccyOptions = currencies.map(c => ({ value: c, label: c }))
  const rate = rates?.[to] ?? null
  const converted = rate != null ? (parseFloat(amount.replace(',', '.')) || 0) * rate : null

  const swap = () => { setFrom(to); setTo(from) }

  return (
    <div className="tool">
      <div className="tool-head">
        <div className="tool-title">{t('dashboard.currency')}</div>
        <button className="tool-action" aria-label={t('dashboard.aria.refreshRates')} onClick={fetchRate}><AnimatedRefreshCwIcon size={14} /></button>
      </div>
      {tripCurrency && tripTitle && <div className="context-hint">Trip currency · {tripCurrency} for {tripTitle}</div>}
      <div className="fx-input">
        <div className="fx-field">
          <label className="lbl" htmlFor="dashboard-fx-from-amount">{t('dashboard.fx.from')}</label>
          <input id="dashboard-fx-from-amount" className="amt mono" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
          <CustomSelect value={from} onChange={v => setFrom(String(v))} options={ccyOptions} searchable size="sm" style={{ marginTop: 6 }} />
        </div>
        <button className="fx-swap" aria-label={t('dashboard.aria.swapCurrencies')} onClick={swap}><ArrowRightLeft size={14} /></button>
        <div className="fx-field">
          <label className="lbl" htmlFor="dashboard-fx-to-amount">{t('dashboard.fx.to')}</label>
          <input id="dashboard-fx-to-amount" className="amt mono" value={converted != null ? converted.toFixed(2) : '—'} readOnly />
          <CustomSelect value={to} onChange={v => setTo(String(v))} options={ccyOptions} searchable size="sm" style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="fx-rate">
        <span>{rate != null ? `1 ${from} = ${rate.toFixed(4)} ${to}` : t('dashboard.fx.unavailable')}</span>
      </div>
    </div>
  )
}

function WeatherTool({ place, date, locale }: { place: Place; date: string; locale: string }): React.ReactElement | null {
  const [weather, setWeather] = useState<Awaited<ReturnType<typeof weatherApi.get>> | null>(null)
  const isFahrenheit = useSettingsStore(s => s.settings.temperature_unit) === 'fahrenheit'
  const isImperial = useSettingsStore(s => s.settings.distance_unit) === 'imperial'
  useEffect(() => {
    if (place.lat == null || place.lng == null) return
    let cancelled = false
    setWeather(null)
    fetchWeather(place.lat, place.lng, date).then(result => { if (!cancelled) setWeather(result) }).catch(() => { if (!cancelled) setWeather(null) })
    return () => { cancelled = true }
  }, [place.lat, place.lng, date])
  if (!weather || weather.error) return null
  const temperature = Math.round(isFahrenheit ? weather.temp * 9 / 5 + 32 : weather.temp)
  const formatTemperature = (value: number) => `${Math.round(isFahrenheit ? value * 9 / 5 + 32 : value)}°`
  const rainAmount = weather.precipitation_sum == null ? null : isImperial
    ? `${(weather.precipitation_sum / 25.4).toFixed(2)} in`
    : `${weather.precipitation_sum.toFixed(1)} mm`
  const windSpeed = weather.wind_max == null ? null : `${Math.round(isImperial ? weather.wind_max * 0.621371 : weather.wind_max)} ${isImperial ? 'mph' : 'km/h'}`
  return (
    <div className="tool weather-tool">
      <div className="tool-head">
        <div className="tool-title"><CloudSun /> Weather</div>
        <span className="weather-kind">{weather.type === 'forecast' ? 'Forecast' : 'Typical'} · {new Date(date + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="weather-place">{place.name}</div>
      <div className="weather-summary">
        <span className="weather-temp">{temperature}°{isFahrenheit ? 'F' : 'C'}</span>
        <span className="weather-condition"><strong>{weather.main}</strong>{weather.description && <small>{weather.description}</small>}</span>
        {(weather.temp_max != null || weather.temp_min != null) && (
          <div className="weather-extremes">
            {weather.temp_max != null && <span><small>High</small><strong>{formatTemperature(weather.temp_max)}</strong></span>}
            {weather.temp_min != null && <span><small>Low</small><strong>{formatTemperature(weather.temp_min)}</strong></span>}
          </div>
        )}
      </div>
      {(weather.precipitation_probability_max != null || rainAmount != null || windSpeed != null) && (
        <div className="weather-details">
          {rainAmount != null && <div><Droplets size={15} aria-hidden="true" /><span><small>Rain</small><strong>{rainAmount}</strong></span></div>}
          {weather.precipitation_probability_max != null && <div><CloudRain size={15} aria-hidden="true" /><span><small>Rain chance</small><strong>{Math.round(weather.precipitation_probability_max)}%</strong></span></div>}
          {windSpeed != null && <div><Wind size={15} aria-hidden="true" /><span><small>Wind</small><strong>{windSpeed}</strong></span></div>}
        </div>
      )}
    </div>
  )
}

// ── Timezone tool ────────────────────────────────────────────────────────────
const DEFAULT_ZONES: string[] = []

// Fallback for the rare browser without Intl.supportedValuesOf.
const FALLBACK_ZONES = [
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

function shortZone(tz: string): string {
  const city = tz.split('/').pop() || tz
  return city.replace(/_/g, ' ')
}

function TimezoneTool({ locale }: { locale: string }): React.ReactElement {
  const { t } = useTranslation()
  const home = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [now, setNow] = useState(() => new Date())
  const isLoaded = useSettingsStore(s => s.isLoaded)
  const updateSetting = useSettingsStore(s => s.updateSetting)
  const stored = useSettingsStore(s => s.settings.dashboard_timezones)
  // Unset (never chosen) starts with only the user's local timezone; an explicit list is honoured.
  const zones = stored ?? [home, ...DEFAULT_ZONES]
  const setZones = (next: string[]) => { updateSetting('dashboard_timezones', next).catch(() => {}) }
  const [adding, setAdding] = useState(false)

  // A minute's resolution is plenty for clocks and keeps re-renders cheap.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // One-time migration of the pre-3.1.3 localStorage value into the user's settings,
  // so a (docker) upgrade no longer resets the widget (#1311).
  useEffect(() => {
    if (!isLoaded) return
    const raw = localStorage.getItem('trek_dashboard_tz')
    if (!raw) return
    let parsed: unknown
    // A malformed/non-array value can never be written, so drop it now to avoid retrying forever.
    try { parsed = JSON.parse(raw) } catch { localStorage.removeItem('trek_dashboard_tz'); return }
    if (!Array.isArray(parsed)) { localStorage.removeItem('trek_dashboard_tz'); return }
    // Only drop the localStorage source once the server has durably stored the value, so a failed
    // write during a (docker) upgrade can't destroy the only copy (#1311). Retry next load.
    updateSetting('dashboard_timezones', parsed)
      .then(() => { localStorage.removeItem('trek_dashboard_tz') })
      .catch(() => { /* keep localStorage; retry on next load */ })
  }, [isLoaded, updateSetting])

  const allZones = React.useMemo<string[]>(() => {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    try { return supported ? supported('timeZone') : FALLBACK_ZONES } catch { return FALLBACK_ZONES }
  }, [])

  const tzOptions = allZones
    .filter(z => !zones.includes(z))
    .map(z => ({ value: z, label: z.replace(/_/g, ' '), searchLabel: z }))

  const addZone = (tz: string) => { if (tz && !zones.includes(tz)) setZones([...zones, tz]); setAdding(false) }
  const removeZone = (tz: string) => setZones(zones.filter(z => z !== tz))

  const timeIn = (tz: string) => now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
  const offsetLabel = (tz: string) => {
    const part = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'short' }).formatToParts(now).find(p => p.type === 'timeZoneName')
    return part?.value || ''
  }

  return (
    <div className="tool">
      <div className="tool-head">
        <div className="tool-title"><Clock size={14} /> {t('dashboard.timezone')}</div>
        <button className="tool-action" aria-label={t('dashboard.aria.addTimezone')} onClick={() => setAdding(a => !a)}>
          {adding ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>
      {adding && (
        <div style={{ marginBottom: 14 }}>
          <CustomSelect value="" onChange={addZone} options={tzOptions} searchable size="sm" placeholder={t('dashboard.tz.searchPlaceholder')} />
        </div>
      )}
      <div className="tz-list">
        {zones.map(tz => (
          <div className="tz-row" key={tz}>
            <div className="tz-dot">{shortZone(tz)[0]?.toUpperCase()}</div>
            <div>
              <div className="tz-city">{shortZone(tz)}</div>
              <div className="tz-sub">{offsetLabel(tz)}</div>
            </div>
            <div className="tz-time mono">{timeIn(tz)}</div>
            <button className="tz-del" aria-label={t('dashboard.aria.removeTimezone', { city: shortZone(tz) })} onClick={() => removeZone(tz)}><X size={13} /></button>
          </div>
        ))}
        {zones.length === 0 && (
          <div className="tz-empty">{t('dashboard.tz.empty')}</div>
        )}
      </div>
    </div>
  )
}

// ── Upcoming reservations tool ───────────────────────────────────────────────
function UpcomingTool({ items, locale, onOpen }: {
  items: UpcomingReservation[]; locale: string; onOpen: (tripId: number) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const timeFormat = useSettingsStore(s => s.settings.time_format)
  return (
    <div className="tool">
      <div className="tool-head">
        <div className="tool-title"><Calendar size={14} /> {t('dashboard.upcoming.title')}</div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', color: 'var(--ink-3)' }}>{t('dashboard.upcoming.empty')}</div>
      ) : (
        <div className="upc-list">
          {items.map(r => {
            // Read the date/time straight from the stored string parts. Going through
            // new Date(...).toISOString() reinterprets the naive local time as UTC and
            // can roll the displayed day forward/back in non-UTC timezones.
            const parsed = splitReservationDateTime(r.reservation_time)
            const datePart = parsed.date || r.day_date || null
            const dateStr = datePart ? splitDate(datePart, locale) : null
            const timeStr = parsed.time ? formatTime(parsed.time, locale, timeFormat) : null
            const typeClass = RES_TYPE_CLASS[r.type] || 'other'
            return (
              <div
                className="upc-item"
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={(e) => openCard(e, `/trips/${r.trip_id}`, () => onOpen(r.trip_id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openCard(e as unknown as React.MouseEvent, `/trips/${r.trip_id}`, () => onOpen(r.trip_id))
                  }
                }}
              >
                <div className="upc-date"><div className="d mono">{dateStr?.d ?? '–'}</div><div className="m">{dateStr?.m ?? ''}</div></div>
                <div className="upc-info">
                  <div className="t">{r.title}</div>
                  <div className="s">
                    {timeStr && <><Clock size={11} /> {timeStr} · </>}
                    {r.location || r.place_name || r.trip_title}
                  </div>
                </div>
                <div className={`upc-type ${typeClass}`}>{RES_ICON[r.type] || <AnimatedTicketIcon size={16} />}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
