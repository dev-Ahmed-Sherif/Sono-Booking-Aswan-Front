import type { AvailableUnitType } from "@/actions/availabilityService";
import type { AvailabilityUnitCard } from "@/lib/availability-inquiry";

export type AvailabilitySearchStatus = "idle" | "loading" | "success" | "error";

export type AvailabilityErrors = {
  startDate?: string;
  nights?: string;
  unitType?: string;
  requestType?: string;
  gender?: string;
  allocationType?: string;
};

export type ReservationInquirySnapshot = {
  startDate: string;
  nights: string;
  selectedUnitTypes: AvailableUnitType[];
  selectedGenders: ("male" | "female")[];
  allocationType: string;
  requestType: string;
  availabilitySearchStatus: AvailabilitySearchStatus;
  availabilityCards: AvailabilityUnitCard[];
  selectedAvailabilityKeys: string[];
  availabilityErrors: AvailabilityErrors;
};

export function emptyReservationInquirySnapshot(): ReservationInquirySnapshot {
  return {
    startDate: "",
    nights: "",
    selectedUnitTypes: [],
    selectedGenders: [],
    allocationType: "",
    requestType: "",
    availabilitySearchStatus: "idle",
    availabilityCards: [],
    selectedAvailabilityKeys: [],
    availabilityErrors: {},
  };
}

export function captureReservationInquirySnapshot(input: {
  startDate: string;
  nights: string;
  selectedUnitTypes: AvailableUnitType[];
  selectedGenders: ("male" | "female")[];
  allocationType: string;
  requestType: string;
  availabilitySearchStatus: AvailabilitySearchStatus;
  availabilityCards: AvailabilityUnitCard[];
  selectedAvailabilityKeys: string[];
  availabilityErrors: AvailabilityErrors;
}): ReservationInquirySnapshot {
  return {
    startDate: input.startDate,
    nights: input.nights,
    selectedUnitTypes: [...input.selectedUnitTypes],
    selectedGenders: [...input.selectedGenders],
    allocationType: input.allocationType,
    requestType: input.requestType,
    availabilitySearchStatus: input.availabilitySearchStatus,
    availabilityCards: [...input.availabilityCards],
    selectedAvailabilityKeys: [...input.selectedAvailabilityKeys],
    availabilityErrors: { ...input.availabilityErrors },
  };
}

export type ApplyReservationInquirySnapshot = {
  setStartDate: (v: string) => void;
  setNights: (v: string) => void;
  setSelectedUnitTypes: (v: AvailableUnitType[]) => void;
  setSelectedGenders: (v: ("male" | "female")[]) => void;
  setAllocationType: (v: string) => void;
  setRequestType: (v: string) => void;
  setAvailabilitySearchStatus: (v: AvailabilitySearchStatus) => void;
  setAvailabilityCards: (v: AvailabilityUnitCard[]) => void;
  setSelectedAvailabilityKeys: (v: string[]) => void;
  setAvailabilityErrors: (v: AvailabilityErrors) => void;
};

export function applyReservationInquirySnapshot(
  snapshot: ReservationInquirySnapshot,
  apply: ApplyReservationInquirySnapshot,
): void {
  apply.setStartDate(snapshot.startDate);
  apply.setNights(snapshot.nights);
  apply.setSelectedUnitTypes([...snapshot.selectedUnitTypes]);
  apply.setSelectedGenders([...snapshot.selectedGenders]);
  apply.setAllocationType(snapshot.allocationType);
  apply.setRequestType(snapshot.requestType);
  apply.setAvailabilitySearchStatus(snapshot.availabilitySearchStatus);
  apply.setAvailabilityCards([...snapshot.availabilityCards]);
  apply.setSelectedAvailabilityKeys([...snapshot.selectedAvailabilityKeys]);
  apply.setAvailabilityErrors({ ...snapshot.availabilityErrors });
}
