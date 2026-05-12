import "./Arrivals.scss";
import moment, { type DurationInputArg1 } from "moment";
import { type ArrivalStopData, type BusRoute, type BusRouteStop, routes } from "./routes";
import SlantWrapper from "../component/SlantWrapper";
import { createEffect, createMemo, createResource, createSignal, on, Show } from "solid-js";
import { API_BASE } from "../util";

const defaultRoute = routes.find((r) => r.Description === "M Line")!;

enum PageState {
  Unloaded,
  Loading,
  Loaded,
}

const [pageState, setPageState] = createSignal(PageState.Unloaded);
const [closest, setClosest] = createSignal<Record<string, string | undefined>>({});
const [selectedRoute, setSelectedRoute] = createSignal(defaultRoute.RouteID.toString());

const [estimates, { refetch: refreshRoutes }] = createResource<ArrivalStopData[]>(
  async () => {
    const response = await fetch(API_BASE + "/api/arrival-estimates")
      .then((x) => x.json())
      .catch(() => {});
    if (!pageState()) return [];
    await updateClosestStops();
    setPageState(PageState.Loaded);
    return response ?? [];
  },
  { initialValue: [] },
);

async function updateClosestStops() {
  const { coords } = (await getLocation()) as { coords: { longitude: number; latitude: number } };

  // Since the area is small, we can ignore Earth's curvature
  const dist = (loc: { Longitude: number; Latitude: number }) =>
    Math.sqrt((coords?.longitude - loc.Longitude) ** 2 + (coords?.latitude - loc.Latitude) ** 2);

  const closest = Object.fromEntries(
    routes.map((r) => {
      if (!coords) return [r.RouteID.toString(), undefined];
      const closestID = r.Stops.reduce((c, s) => (dist(s) < dist(c) ? s : c))?.RouteStopID;
      return [r.RouteID.toString(), closestID?.toString()];
    }),
  );
  setClosest(closest);
}

setInterval(() => {
  // intentionally runs after component unmount, just not before initial render
  if (pageState()) refreshRoutes();
}, 30000);

const getLocation = () =>
  new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, resolve, { timeout: 1000 });
  });

interface BusStopDisplayProps {
  routeID: string;
  stopData: BusRouteStop;
  estimates: ArrivalStopData[];
}

function BusStopDisplay(props: BusStopDisplayProps) {
  const className = createMemo(() => {
    const isClosest = closest()[props.routeID] === props.stopData.RouteStopID.toString();
    return "route-stop" + (isClosest ? " selected" : "");
  });

  const vehicleEstimates = createMemo(() => {
    const estimate = props.estimates?.find(
      (times) => times.RouteStopID === props.stopData.RouteStopID,
    );
    return estimate?.VehicleEstimates;
  });

  const times = createMemo(() => {
    const estimates = vehicleEstimates();
    if (!estimates?.length) {
      return { absolute: "", relative: "(No Service)" };
    }

    const nextArrival = estimates.map((x) => x.SecondsToStop).reduce((p, e) => Math.min(p, e));

    const now = moment().startOf("minute") as DurationInputArg1;
    const arrival =
      nextArrival === 0
        ? "Arrived"
        : moment().add(nextArrival, "s").startOf("minute").subtract(now).minutes() + " mins";

    const relative = arrival.replace(/^1 mins/, "1 min").replace(/^0 mins/, "<1 min");
    const absolute = moment().add(nextArrival, "s").format("hh:mm A");
    return { absolute, relative };
  });

  return (
    <div class={className()}>
      <span>{times().absolute}</span>
      <span>{times().relative}</span>
      <span>{props.stopData.SignVerbiage}</span>
    </div>
  );
}

interface BusRouteProps {
  route: BusRoute;
}
function BusRouteDisplay(props: BusRouteProps) {
  const estimates2 = estimates().filter((est) => est.RouteID === props.route.RouteID);
  const vehicleIDs = new Set(
    estimates2.flatMap((e) => e.VehicleEstimates.map((ve) => ve.VehicleID)),
  );

  const arrivalEstimateMultipliers = [];

  for (const busID of vehicleIDs) {
    // Last item is a duplicate of the first
    const times = estimates2
      .slice(0, -1)
      .map((details) => {
        const arrivalRaw = details.VehicleEstimates.find((ve) => ve.VehicleID === busID);
        if (!arrivalRaw) return null;
        const estimateRaw = details.ScheduledTimes.find((st) => st.AssignedVehicleId === busID);
        const arrival = moment().add(arrivalRaw?.SecondsToStop, "s").toDate().getTime();
        const estimate = moment(estimateRaw?.ArrivalTimeUTC).toDate().getTime();

        return {
          arrivalRaw,
          estimateRaw,
          arrival,
          estimate,
          arrivalRelative: arrivalRaw?.SecondsToStop,
          name: routes.flatMap((r) => r.Stops).find((s) => s.RouteStopID === details.RouteStopID)
            ?.SignVerbiage,
        };
      })
      .filter((x) => !!x);

    times.sort((a, b) => a!.estimate - b!.estimate);

    // Times should be sorted before new properties are added
    const times2 = times
      .map((data, index) => {
        const { arrivalRaw, arrival, estimate, name } = data!;
        const nextArrivalRaw = times[(index + 1) % times.length]!.arrivalRaw;
        const nextEstRaw = times[(index + 1) % times.length]!.estimateRaw;
        const arrivalDiffRaw =
          nextArrivalRaw && nextArrivalRaw.SecondsToStop - arrivalRaw.SecondsToStop;
        // assume some time between intra-minute stops
        const arrivalDiff = arrivalDiffRaw! > 0 ? arrivalDiffRaw : null;
        let scheduleDiff =
          moment.duration(moment(nextEstRaw?.ArrivalTimeUTC).diff(estimate)).asSeconds() ||
          (30 as number | null);
        if (scheduleDiff! < 0) scheduleDiff = null;

        return {
          arrival,
          estimate,
          arrivalRelative: arrivalRaw?.SecondsToStop,
          arrivalDiff,
          scheduleDiff,
          diffRatio: arrivalDiff && scheduleDiff && scheduleDiff / arrivalDiff,
          name,
        };
      })
      .filter((x) => x.arrivalRelative! > 0 && x.diffRatio);

    const vehicleArrivalEstimateMultiplier =
      times2.reduce((tot, curr) => tot + curr.diffRatio!, 0) / times2.length;
    // estimates are never that much under; this indicates conditions like transitionary periods
    if (vehicleArrivalEstimateMultiplier! > 0.75) {
      arrivalEstimateMultipliers.push(vehicleArrivalEstimateMultiplier);
    }
  }

  const averageMultiplier =
    arrivalEstimateMultipliers.reduce((a, b) => a + b, 0) / arrivalEstimateMultipliers.length || 1;
  // Multiplier Debug: console.log(`Average multiplier for ${route.Description} is ${averageMultiplier}`)
  const fixedEstimates = createMemo(() => {
    const adjusted = estimates();
    for (const estimate of adjusted.flatMap((est) => est.VehicleEstimates)) {
      estimate.SecondsToStop *= averageMultiplier;
    }
    return adjusted;
  });

  return (
    <div
      class="route"
      id={props.route.RouteID.toString()}
      style={{ "border-color": props.route.MapLineColor }}
    >
      {props.route.Stops.map((stop) => (
        <BusStopDisplay
          routeID={props.route.RouteID.toString()}
          stopData={stop}
          estimates={fixedEstimates()}
        />
      ))}
    </div>
  );
}

function BusRouteList() {
  const shownRoute = createMemo(() => routes.find((r) => r.RouteID.toString() === selectedRoute()));

  return (
    <Show when={pageState() === PageState.Loaded && shownRoute()}>
      <BusRouteDisplay route={shownRoute()!} />
    </Show>
  );
}

export default function Arrivals() {
  document.title = "Anteater Express Arrivals | Ant Atlas";

  updateClosestStops();
  if (!pageState()) {
    setPageState(PageState.Loading);
    refreshRoutes();
  }

  createEffect(on(selectedRoute, refreshRoutes, { defer: true }));

  return (
    <>
      <h1 class="app-header arrivals-header">
        <SlantWrapper highContrast>
          <span>
            <i class="fa fa-bus"></i> Arrival Estimates
          </span>
        </SlantWrapper>
        <SlantWrapper>
          <select
            class="routes"
            onInput={(e) => setSelectedRoute(e.target.value)}
            value={selectedRoute()}
          >
            <option value="" disabled>
              Select
            </option>
            {routes.map((r) => (
              <option value={r.RouteID}>{r.Description}</option>
            ))}
          </select>
        </SlantWrapper>
        <SlantWrapper>
          <button onClick={refreshRoutes} disabled={estimates.loading}>
            <i class="fa fa-refresh"></i>
          </button>
        </SlantWrapper>
        <SlantWrapper class="standalone-only">
          <a
            href="https://ucirvine.transloc.com/iframe.aspx?routeid=4,5,6,7,8&showRouteMenu=false&showMainMenu=false"
            target="_blank"
          >
            <i class="fa fa-map-o"></i>
          </a>
        </SlantWrapper>
      </h1>
      <div class="content-wrapper">
        <BusRouteList />
      </div>
    </>
  );
}
