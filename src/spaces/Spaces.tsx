import {
  cslRoomMapping,
  locationGroups,
  spaceDetails,
  type UniversalLookupItem,
} from "./space-info";
import "./Spaces.scss";
import moment from "moment";
import SlantWrapper from "../component/SlantWrapper";
import { createEffect, createMemo, createSignal, on, Show } from "solid-js";
import { API_BASE } from "../util";

function handleDateChange(event: FocusEvent, oldDate: Date) {
  const date = (event.target as HTMLInputElement).valueAsDate!;
  if (date.getTime() !== oldDate.getTime()) setDate(date);
}

interface TimeSlot {
  start: string;
  end: string;
  itemId: number;
}

interface TimeSlotListing {
  start: string;
  end: string;
  spaceIDs: number[];
}

interface APISpacesResponse {
  libraries: TimeSlot[];
  antcaves: TimeSlot[];
  courtyard: TimeSlot[];
}

let busy = false;
async function updateRoomAvailability() {
  if (busy) return [];
  const dateStr = date().toISOString().split("T")[0];

  busy = true;
  const response: APISpacesResponse = await fetch(
    API_BASE + "/api/space-availability?date=" + dateStr,
  ).then((x) => x.json());
  // Normalize Courtyard Response
  [...response.antcaves, ...response.libraries].forEach((timeSlot) => {
    if (!spaceDetails[timeSlot.itemId]) return;

    const roomTimes = spaceDetails[timeSlot.itemId].times;
    if (!roomTimes.includes(timeSlot.start)) roomTimes.push(timeSlot.start);
    roomTimes.push(timeSlot.end);
  });
  busy = false;

  response.courtyard.forEach((timeSlot) => {
    if (!cslRoomMapping[timeSlot.itemId]) return;

    const roomTimes = cslRoomMapping[timeSlot.itemId].times;
    if (!roomTimes.includes(timeSlot.start)) roomTimes.push(timeSlot.start);
    roomTimes.push(timeSlot.end);
  });

  // console.log(response, courtyard, spaceDetails)
  const sortedTimes = [...response.antcaves, ...response.libraries, ...response.courtyard]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .filter((t) => getAnySpace(t.itemId))
    .reduce((times: TimeSlotListing[], curr: TimeSlot) => {
      if (times.at(-1)?.start !== curr.start)
        times.push({ start: curr.start, end: curr.end, spaceIDs: [curr.itemId] });
      else times.at(-1)!.spaceIDs.push(curr.itemId);
      return times;
    }, []);

  setEmpty(!sortedTimes.length);
  setTimes(sortedTimes);
}

interface SpaceInfoProps {
  start: string;
  end: string;
  space: number;
  timeIdx: number;
}

function SpaceInfo({ start, end, space, timeIdx }: SpaceInfoProps) {
  while (times()[timeIdx]?.spaceIDs?.includes(space)) {
    end = times()[timeIdx].end;
    while (times()[timeIdx] && times()[timeIdx].start < end) timeIdx++;
  }

  const dateStr = moment(start)
    .toISOString()
    .replace(/:00\.000Z$/, "Z");
  const hours = Math.round(moment(end).diff(start, "hours", true) * 10) / 10;
  const totMins = moment(end).diff(start, "minutes", true);
  const duration = hours < 1 ? totMins + " m" : hours + " hr"; /* + (hours > 1 ? 's' : '') */
  const spaceName = spaceDetails[space]?.title ?? cslRoomMapping[space]?.name;
  const grouping = getAnySpace(space)?.grouping;
  const capacity = getAnySpace(space)?.capacity;
  const group = locationGroups[grouping];

  const bookingURL = group.bookingURL.replace(
    /\/spaces\?.*$|\/reserve\/.*$/,
    `/space/${space}?date=${dateStr}#submit_times`,
  );
  const endTitle =
    "Available until " +
    new Date(end).toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: true });
  const capacityTitle =
    capacity === 1 ? "This is an individual-only room" : `This room holds up to ${capacity} people`;

  return (
    <div class="space-info">
      <a
        href={"https://map.uci.edu/?id=463#!sbc?m/" + group.mapID}
        target="_blank"
        class="marker"
        data-name={group.name}
        title={group.fullName}
      >
        {group.name}
      </a>
      <span>{spaceName}</span>
      <span title={endTitle}>
        <i class="fa fa-clock-o"></i> {duration}
      </span>
      <span title={capacityTitle}>
        <i class="fa fa-users"></i> {capacity}
      </span>
      <a href={bookingURL} target="_blank">
        <i class="fa fa-arrow-right"></i>
      </a>
    </div>
  );
}

function getAnySpace(key: number): UniversalLookupItem {
  return spaceDetails[key] ?? cslRoomMapping[key];
}

interface AvailabilityProps {
  time: TimeSlotListing;
  index: number;
}
function Availability(props: AvailabilityProps) {
  const [collapsed, setCollapsed] = createSignal(true);

  const spaceIDs = createMemo(() => {
    return props.time.spaceIDs.filter(
      (id) => localStorage.spaces_showAll || !spaceDetails[id]?.hidden,
    );
  });

  const startText = createMemo(() => {
    const timeStringConfig: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    };
    return new Date(props.time.start).toLocaleTimeString("en-US", timeStringConfig);
  });

  const largest = createMemo(() => {
    return Math.max(...spaceIDs().map((id) => getAnySpace(id)?.capacity ?? 0));
  });

  const markers = createMemo(() => {
    const places = spaceIDs().map((id) => locationGroups[getAnySpace(id)?.grouping].name);
    return [...new Set(places)].map((name) => <div data-name={name} class="marker small"></div>);
  });

  return (
    <Show when={spaceIDs().length > 0}>
      <h2
        class={"space-name" + (collapsed() ? " collapsed" : "")}
        onClick={() => setCollapsed(!collapsed())}
      >
        <span class="time">{startText()}</span>
        <span class="count">
          <i class="fa fa-window-restore"></i> {spaceIDs().length}
        </span>
        <span class="group-size">
          <i class="fa fa-users"></i> {largest()}
        </span>
        <span class="places">{markers()}</span>
      </h2>
      <div class="space-contents">
        {spaceIDs().map((id) => (
          <SpaceInfo
            start={props.time.start}
            end={props.time.end}
            space={id}
            timeIdx={props.index}
          />
        ))}
      </div>
    </Show>
  );
}

function Empty() {
  return (
    <div class="content-wrapper">
      <h2 class="center">
        <i class="fa fa-clock-o"></i> No Times Available
      </h2>
    </div>
  );
}

const [isMounted, setIsMounted] = createSignal(false);
const [empty, setEmpty] = createSignal(false);
const [date, setDate] = createSignal(new Date());
const [times, setTimes] = createSignal<TimeSlotListing[]>([]);
const [tokenExpires, setTokenExpires] = createSignal("in ...");

const updateExpiry = ({ timestamp }: { timestamp: number }) =>
  setTokenExpires(moment(timestamp).fromNow());

export default function Spaces() {
  const today = new Date().toISOString().replace(/T.*$/, "");
  const maintainer = localStorage.maintainerView === "true";

  document.title = "Study Spaces | Ant Atlas";

  if (!isMounted()) {
    setIsMounted(true);
    updateRoomAvailability();

    if (maintainer) {
      fetch(API_BASE + "/api/spaces-token/expiry")
        .then((x) => x.json())
        .then(updateExpiry);
    }
  }

  createEffect(on(date, updateRoomAvailability, { defer: true }));

  return (
    <>
      <h1 class="app-header">
        <SlantWrapper highContrast>
          <span>
            <i class="fa fa-tv"></i> Space Availability
          </span>
        </SlantWrapper>
        <SlantWrapper>
          <input
            type="date"
            id="reservation-date-input"
            onBlur={(e) => handleDateChange(e, date())}
            value={today}
            min={today}
          />
        </SlantWrapper>
      </h1>
      {maintainer && <p class="token-expiry">Token expires {tokenExpires()}</p>}
      {empty() ? (
        <Empty />
      ) : (
        <div class="content-wrapper spaces-wrapper">
          {times().map((t, i) => (
            <Availability time={t} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
