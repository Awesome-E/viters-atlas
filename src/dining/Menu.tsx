import "./Menu.scss";
import SlantWrapper from "../component/SlantWrapper";
import { createEffect, createSignal, on } from "solid-js";
import { API_BASE } from "../util";

type TraitsLookup = Record<string, { label: string; value: string }[]>;

interface MenuStationItemLookup {
  id: number;
  skus: string[];
}
interface MenuStation {
  id: number;
  name: string;
  position: number;
  _products: MenuProduct[];
}
interface DiningHour {
  name: string;
  id: number;
  position: number;
  start: string;
  end: string;
}
interface DiningLocation {
  name: string;
  max_menus_date: string;
  stations: MenuStation[];
  meals_for_date: DiningHour[];
  meal_for_time: DiningHour;
  product_attributes: TraitsLookup;
}
interface MenuProduct {
  sku: string;
  uid: string;
  name: string;
  attributes: Record<string, unknown>;
  _traits_lookup: TraitsLookup;
}
interface DiningMenus {
  products: Record<string, MenuProduct>;
  station_items: MenuStationItemLookup[];
}
interface MenusResponse {
  location: DiningLocation;
  menus: DiningMenus;
  period_id: number;
}

const defaultToday = new Date().toISOString().replace(/T.*$/, "");
const getTime = () => new Date().toISOString().replace(/^.*T|Z$/g, "");

const [maxMenuDate, setMaxMenuDate] = createSignal(defaultToday);
const [stations, setStations] = createSignal<MenuStation[]>([]);
const [hours, setHours] = createSignal<DiningHour[]>([]);
const [isEmpty, setIsEmpty] = createSignal(false);

const [selectedLocation, setSelectedLocation] = createSignal("the-anteatery");
const [selectedDate, setSelectedDate] = createSignal(defaultToday);
const [selectedMeal, setSelectedMeal] = createSignal("");

async function updateMenus(location: string, periodId: string, date: string) {
  const query = {
    location,
    periodId: periodId || "0",
    date: new Date(date).toISOString(),
  };
  const url = `${API_BASE}/api/menus?${new URLSearchParams(query).toString()}`;
  setStations([]);
  setIsEmpty(false);

  const data: MenusResponse = await fetch(url).then((x) => x.json());

  const stations = data.location.stations.sort((a, b) => a.position - b.position);
  stations.forEach((station) => {
    const mapped = data.menus.station_items.find((s) => s.id === station.id);

    station._products =
      mapped?.skus
        ?.map((sku) => {
          const unprefixed = sku.replace(/(\w+_\d+)_\d+$/, "$1");
          if (sku !== unprefixed && unprefixed in data.menus.products) return null;
          return data.menus.products[sku];
        })
        ?.filter((x) => !!x) ?? [];

    station._products.forEach((p) => {
      p._traits_lookup = data.location.product_attributes;
    });
  });

  setIsEmpty(!data.location.meals_for_date.length || !data.menus.station_items.length);

  const actualPeriodId = data.period_id?.toString() ?? "";

  setHours(data.location?.meals_for_date ?? []);
  setStations(stations);
  setSelectedMeal(actualPeriodId);
  setMaxMenuDate(data.location.max_menus_date);
}

/**
 * Hashes a string into a color
 * @param str The string to hash into a color
 * @returns A hex color
 */
function stringToColor(str: string, max: number = 255) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let colour = "#";
  for (let i = 0; i < 3; i++) {
    const value = Math.round((max / 255) * ((hash >> (i * 8)) & 0xff));
    colour += ("00" + value.toString(16)).substr(-2);
  }
  return colour;
}

function ProductDisplay({ product }: { product: MenuProduct }) {
  const attributes = product._traits_lookup.recipe_attributes;
  const productTraits = [product.attributes.recipe_attributes].flat();
  const attrIdOf = (name: string) => attributes.find((a) => a.label === name)?.value;

  const veganStr = productTraits.includes(attrIdOf("Vegan")) ? "🍃" : "";
  const vegetarianStr = productTraits.includes(attrIdOf("Vegetarian")) ? "🥬" : "";
  const text = product.name + " " + (veganStr || vegetarianStr);
  return (
    <div class="menu-item" data-categories={productTraits}>
      {text}
    </div>
  );
}

function getLocalConfig(key: string) {
  try {
    return JSON.parse(localStorage[key]);
  } catch {
    return {};
  }
}

const collapsed: { [k: string]: boolean } = getLocalConfig("collapsedMenus");

function toggleStationContents(event: MouseEvent) {
  const element = event.target as HTMLHeadingElement;
  collapsed[element.dataset.id as string] = element.classList.toggle("collapsed");
  localStorage.collapsedMenus = JSON.stringify(collapsed);
}

function MenuDisplay() {
  return (
    <div class="content-wrapper menu-wrapper">
      {stations()
        .filter((s) => s._products.length)
        .map((s) => {
          const color = stringToColor(s.name, 210);
          const hidden = collapsed[s.id] ? " collapsed" : "";
          return (
            <>
              <h2
                class={"station-name" + hidden}
                style={{ "background-color": color }}
                onClick={toggleStationContents}
                data-id={s.id}
              >
                {s.name}
              </h2>
              <div
                class="station-contents"
                id={s.name + "-contents"}
                style={{ "border-color": color }}
              >
                {s._products.map((p) => (
                  <ProductDisplay product={p} />
                ))}
              </div>
            </>
          );
        })}
    </div>
  );
}

function Closed() {
  return (
    <div class="content-wrapper">
      <h2 class="center">
        <i class="fa fa-clock-o"></i> No Menu Available
      </h2>
    </div>
  );
}

export default function Menu() {
  document.title = "Dining Menus | Ant Atlas";
  const [mealTitle, setMealTitle] = createSignal("");

  if (!selectedMeal()) {
    // Before any menu loads
    updateMenus("the-anteatery", "", `${selectedDate()}T${getTime()}Z`);
  }

  createEffect(
    on(
      [selectedLocation, selectedMeal, selectedDate],
      () => {
        updateMenus(selectedLocation(), selectedMeal(), `${selectedDate()}T${getTime()}Z`);
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const targetMeal = hours().find((h) => h.id.toString() === selectedMeal());
    const title = targetMeal ? `${targetMeal.name} (${targetMeal.start}-${targetMeal.end})` : "";
    setMealTitle(title);
  });

  return (
    <>
      <h1 class="app-header">
        <SlantWrapper>
          <select id="location-select" onInput={(e) => setSelectedLocation(e.target.value)}>
            <option value="the-anteatery">Mesa</option>
            <option value="brandywine">Brandy</option>
          </select>
        </SlantWrapper>
        <SlantWrapper>
          <input
            type="date"
            id="date-select"
            value={selectedDate()}
            min={defaultToday}
            max={maxMenuDate()}
            onBlur={(e) => setSelectedDate(e.target.value)}
          />
        </SlantWrapper>
        <SlantWrapper>
          <select
            id="meal-select"
            onInput={(e) => setSelectedMeal(e.target.value)}
            value={selectedMeal()}
            title={mealTitle()}
          >
            <option value="" disabled>
              Select
            </option>
            {hours().map((h) => (
              <option value={h.id} selected={selectedMeal() === h.id.toString()}>
                {h.name}
              </option>
            ))}
          </select>
        </SlantWrapper>
      </h1>
      {isEmpty() ? <Closed /> : <MenuDisplay />}
    </>
  );
}
