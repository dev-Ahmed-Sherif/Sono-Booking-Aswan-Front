"use server";

import axios from "@/lib/axios-auth";
import { getAllExtensions } from "@/actions/settings/extensionService";
import { getAllReservations } from "@/actions/reservationService";
import { getAllRequests, getRequestUnitsAll } from "@/actions/requestService";
import { getAccessToken } from "@/lib/token-helper";
import {
  applyAvailabilityHierarchyFilters,
  type AvailabilityHierarchyFilterInput,
} from "@/lib/availability-hierarchy";
import {
  formatAvailabilityGenderHeader,
  type AvailabilityInquiryDates,
} from "@/lib/availability-dates";
import {
  buildUnitBlockingEndIndex,
  parseAvailabilityBookingArrays,
  type UnitBlockingEndIndex,
} from "@/lib/availability-occupancy";

/**
 * Beds/Rooms/Apartments getAll: anonymous callers must send Status; backend
 * accepts "متاح" or "Available" (OrdinalIgnoreCase). Use ASCII here so Node
 * axios does not drop/mangle non-Latin-1 header values on server actions.
 */
const AVAILABLE_STATUS_HEADER = "Available";

function extractAxiosErrorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: unknown };
    message?: string;
  };
  const data = err.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const msg =
      (typeof o.message === "string" && o.message) ||
      (typeof o.Message === "string" && o.Message) ||
      (typeof o.title === "string" && o.title) ||
      (typeof o.detail === "string" && o.detail);
    if (msg) return String(msg);
  }
  return err.message || "An unexpected error occurred";
}

const asList = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];
  const obj = response as Record<string, unknown>;
  const level1 =
    obj.data ?? obj.Data ?? obj.items ?? obj.Items ?? obj.result ?? obj.Result;
  if (Array.isArray(level1)) return level1;
  if (level1 && typeof level1 === "object") {
    const nested = level1 as Record<string, unknown>;
    const level2 =
      nested.data ??
      nested.Data ??
      nested.items ??
      nested.Items ??
      nested.result ??
      nested.Result;
    if (Array.isArray(level2)) return level2;
  }
  return [];
};

const getAvailableList = async (
  path: string,
  inquiry?: AvailabilityInquiryDates,
) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Status: AVAILABLE_STATUS_HEADER,
  };
  const startYmd = inquiry?.startDateYmd?.trim();
  if (startYmd) {
    headers.StartDate = startYmd;
    if (
      inquiry?.nights != null &&
      Number.isFinite(inquiry.nights) &&
      inquiry.nights > 0
    ) {
      headers.Nights = String(Math.trunc(inquiry.nights));
    }
  }
  const genderHeader = formatAvailabilityGenderHeader(inquiry?.genders);
  if (genderHeader) {
    headers.Gender = genderHeader;
  }

  const res = await axios.get(`${process.env.BACK_END}/${path}`, {
    withCredentials: true,
    headers,
  });
  return asList(res.data);
};

const getCatalogList = async (path: string) => {
  const res = await axios.get(`${process.env.BACK_END}/${path}`, {
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return asList(res.data);
};

export type AvailableUnitType = "bed" | "room" | "apartment";

export type CatalogUnitType = "bed" | "room";

/** Beds/rooms catalog without `Status` filter (all statuses for hierarchy checks). */
export async function getCatalogUnits(unitType: CatalogUnitType) {
  const path = unitType === "bed" ? "Beds/getAll" : "Rooms/getAll";
  try {
    const list = await getCatalogList(path);
    return { data: list };
  } catch (error: unknown) {
    return {
      error: "Request Failed",
      message: extractAxiosErrorMessage(error),
    };
  }
}

export async function getAvailableUnits(
  unitType: AvailableUnitType,
  inquiry?: AvailabilityInquiryDates,
) {
  const path =
    unitType === "bed"
      ? "Beds/getAll"
      : unitType === "room"
        ? "Rooms/getAll"
        : "Apartments/getAll";
  try {
    const list = await getAvailableList(path, inquiry);
    return { data: list };
  } catch (error: unknown) {
    return {
      error: "Request Failed",
      message: extractAxiosErrorMessage(error),
    };
  }
}

/** Loads active request/extension end dates per unit when the user session allows it. */
export async function loadUnitBlockingEndIndex(
  bedsRaw: unknown[],
  roomsRaw: unknown[],
  excludeRequestId?: string,
): Promise<UnitBlockingEndIndex | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const [requestsRes, extensionsRes, requestUnitsRes, reservationsRes] =
      await Promise.all([
        getAllRequests(),
        getAllExtensions(),
        getRequestUnitsAll(),
        getAllReservations(),
      ]);

    const booking = parseAvailabilityBookingArrays({
      requestsRes,
      extensionsRes,
      requestUnitsRes,
      reservationsRes,
    });

    if (
      booking.requestsRaw.length === 0 &&
      booking.extensionsRaw.length === 0 &&
      booking.requestUnitsRaw.length === 0
    ) {
      return null;
    }

    return buildUnitBlockingEndIndex({
      ...booking,
      bedsRaw,
      roomsRaw,
      ...(excludeRequestId?.trim()
        ? { excludeRequestIds: [excludeRequestId.trim()] }
        : {}),
    });
  } catch {
    return null;
  }
}

function hierarchyFilterInput(
  apartmentsRaw: unknown[],
  roomsRaw: unknown[],
  bedsRaw: unknown[],
  inquiry?: AvailabilityInquiryDates,
  occupancyIndex?: UnitBlockingEndIndex | null,
  catalogBedsRaw?: unknown[],
  catalogRoomsRaw?: unknown[],
): AvailabilityHierarchyFilterInput {
  return {
    apartments: apartmentsRaw,
    rooms: roomsRaw,
    beds: bedsRaw,
    ...(catalogBedsRaw?.length ? { catalogBeds: catalogBedsRaw } : {}),
    ...(catalogRoomsRaw?.length ? { catalogRooms: catalogRoomsRaw } : {}),
    ...(inquiry?.startDateYmd ? { inquiry } : {}),
    ...(occupancyIndex ? { occupancyIndex } : {}),
  };
}

const getAvailableUnitTypes = async () => {
  try {
    const [bedsRaw, roomsRaw, apartmentsRaw, catalogBedsRes, catalogRoomsRes] =
      await Promise.all([
      getAvailableList("Beds/getAll"),
      getAvailableList("Rooms/getAll"),
      getAvailableList("Apartments/getAll"),
      getCatalogList("Beds/getAll"),
      getCatalogList("Rooms/getAll"),
    ]);
    const catalogBedsRaw = Array.isArray(catalogBedsRes) ? catalogBedsRes : [];
    const catalogRoomsRaw = Array.isArray(catalogRoomsRes)
      ? catalogRoomsRes
      : [];
    const { beds, rooms, apartments } = applyAvailabilityHierarchyFilters(
      hierarchyFilterInput(
        apartmentsRaw,
        roomsRaw,
        bedsRaw,
        undefined,
        undefined,
        catalogBedsRaw,
        catalogRoomsRaw,
      ),
    );

    const options: Array<{ value: string; label: string }> = [];
    if (beds.length > 0) options.push({ value: "bed", label: "سرير" });
    if (rooms.length > 0) options.push({ value: "room", label: "غرفة" });
    if (apartments.length > 0)
      options.push({ value: "apartment", label: "شقة كاملة" });

    return { data: options };
  } catch (error: unknown) {
    return {
      error: "Request Failed",
      message: extractAxiosErrorMessage(error),
    };
  }
};

export { getAvailableUnitTypes };

