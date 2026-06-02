"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  reservationRequestSchema,
  type ReservationRequestFormValues,
} from "@/schemas";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getAvailableUnits } from "@/actions/availabilityService";
import { getCompanions } from "@/actions/companionService";
import { getUserById } from "@/actions/permissions/userService";
import { addRequest } from "@/actions/requestService";
import { getRelationships } from "@/actions/settings/relationshipService";
import { useToast } from "@/hooks/use-toast";
import {
  getLookupArray,
  hierarchyFilteredAvailabilityLists,
  mapGenericOptions,
  type ReservationStoredUnitSnapshot,
} from "@/lib/availability-inquiry";
import { mapCompanionDtoToFormEntry } from "@/lib/companion-registration";
import {
  enrichUnitsWithApartmentGender,
  extractAvailabilityList,
  parseGuestGenderStrict,
  parseInquiryGenders,
  parseStoredReservationUnits,
  resolveGuestsForReservationValidation,
  resolvePersonGuestGender,
  validateReservationGuestsAgainstUnits,
  type GuestGender,
} from "@/lib/reservation-guest-unit-validation";
import {
  enrichStoredUnitsWithHierarchyIds,
  mapReservationToAddRequestDto,
  parseAddRequestApiResult,
  type AddRequestDtoPayload,
  type ReservationInquiryFormSnapshot,
} from "@/lib/housing-request-map";
import { oncePerSession } from "@/lib/server-action-cache";

type ReservationCompanion = {
  id: string;
  name: string;
  gender?: GuestGender;
  /** Arabic label from parent when known (else resolved from saved companions / relationships). */
  relationshipLabel?: string;
};

type ReservationLocalStoragePayload = {
  form?: {
    /** Canonical yyyy-MM-dd from inquiry (preferred for `<input type="date">`). */
    startDateYmd?: string | null;
    startDate?: string | null;
    startDateDisplay?: string | null;
    nights?: string | number | null;
    unitTypeLabel?: string | null;
    requestTypeLabel?: string | null;
    /** Legacy single-select */
    gender?: string | null;
    genderLabel?: string | null;
    /** Multi-select (parallel arrays, same order) */
    genders?: unknown;
    genderLabels?: unknown;
    allocationTypeLabel?: string | null;
    requestType?: string | null;
    allocationType?: string | null;
  };
  selectedUnits?: unknown;
};

type StoredInquirySnapshot = {
  unitTypeLabel?: string;
  requestTypeLabel?: string;
  genderLabel?: string;
  allocationTypeLabel?: string;
  units: { title: string; subtitle?: string; priceLabel?: string }[];
};

const RESERVATION_STORAGE_KEY = "reservation";

function readReservationFromLocalStorage():
  | ReservationLocalStoragePayload
  | undefined {
  try {
    const item =
      typeof window !== "undefined"
        ? window.localStorage.getItem(RESERVATION_STORAGE_KEY)
        : null;
    if (!item || item === "undefined" || item === "null") return undefined;
    return parseReservationPayload(JSON.parse(item));
  } catch {
    return undefined;
  }
}

function parseReservationPayload(
  raw: unknown,
): ReservationLocalStoragePayload | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as ReservationLocalStoragePayload;
}

/** date-fns with `locale: ar` may format digits in Eastern Arabic numerals — normalize for yyyy-MM-dd. */
function normalizeDigitsToAscii(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

function parseStartDateFromForm(
  formData: NonNullable<ReservationLocalStoragePayload["form"]>,
): string | undefined {
  const ymdFrom = (raw: unknown): string | undefined => {
    if (typeof raw !== "string") return undefined;
    const t = normalizeDigitsToAscii(raw.trim());
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
  };

  const fromYmd = ymdFrom(formData.startDateYmd);
  if (fromYmd) return fromYmd;

  const fromDisplay = ymdFrom(formData.startDateDisplay);
  if (fromDisplay) return fromDisplay;

  const iso = formData.startDate;
  if (typeof iso === "string" && iso.length > 0) {
    const isoNorm = normalizeDigitsToAscii(iso.trim());
    const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(isoNorm);
    if (prefix) return prefix[1];
    const d = new Date(isoNorm);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  return undefined;
}

function parseNightsFromForm(
  formData: NonNullable<ReservationLocalStoragePayload["form"]>,
): number | undefined {
  const raw = formData.nights;
  const str =
    typeof raw === "number"
      ? String(Math.trunc(raw))
      : normalizeDigitsToAscii(String(raw ?? "").trim());
  const n = Number(str);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return undefined;
}

function nonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function resolveStoredGenderSummary(
  formData: NonNullable<ReservationLocalStoragePayload["form"]>,
): string | undefined {
  if (Array.isArray(formData.genderLabels)) {
    const parts = formData.genderLabels.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    if (parts.length) return parts.join("، ");
  }
  if (Array.isArray(formData.genders)) {
    const parts = formData.genders
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => (v === "male" ? "رجال" : v === "female" ? "سيدات" : v));
    if (parts.length) return parts.join("، ");
  }
  const legacyLabel = nonEmptyString(formData.genderLabel);
  if (legacyLabel) return legacyLabel;
  const legacyG = nonEmptyString(formData.gender);
  if (!legacyG) return undefined;
  if (legacyG === "male") return "رجال";
  if (legacyG === "female") return "سيدات";
  return legacyG;
}

function parseStoredUnitPrice(o: Record<string, unknown>): string | undefined {
  const pl = nonEmptyString(o.priceLabel) ?? nonEmptyString(o.PriceLabel);
  if (pl) return pl;
  const price = o.price ?? o.Price;
  if (price != null && Number.isFinite(Number(price))) {
    return `${Number(price).toLocaleString("ar-EG")} ج.م`;
  }
  return undefined;
}

function parseStoredUnits(
  raw: unknown,
): { title: string; subtitle?: string; priceLabel?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const title = nonEmptyString(o.title) ?? "";
      if (!title) return null;
      const subtitle = nonEmptyString(o.subtitle);
      const priceLabel = parseStoredUnitPrice(o);
      return {
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(priceLabel ? { priceLabel } : {}),
      };
    })
    .filter(
      (x): x is { title: string; subtitle?: string; priceLabel?: string } =>
        x != null,
    );
}

function hydrateReservationFromLocalStorage(
  setStoredInquiry: Dispatch<SetStateAction<StoredInquirySnapshot | null>>,
  setStoredSelectedUnits: Dispatch<
    SetStateAction<ReservationStoredUnitSnapshot[]>
  >,
  setInquiryGenders: Dispatch<SetStateAction<GuestGender[]>>,
  setValue: UseFormSetValue<ReservationRequestFormValues>,
): void {
  const saved = readReservationFromLocalStorage();
  if (!saved) {
    setStoredInquiry(null);
    setStoredSelectedUnits([]);
    setInquiryGenders([]);
    return;
  }

  setStoredSelectedUnits(parseStoredReservationUnits(saved?.selectedUnits));
  setInquiryGenders(
    parseInquiryGenders(
      saved?.form && typeof saved.form === "object"
        ? (saved.form as Record<string, unknown>)
        : undefined,
    ),
  );

  const formData = saved?.form;
  if (!formData || typeof formData !== "object") {
    setStoredInquiry(null);
    return;
  }

  const nextStart = parseStartDateFromForm(formData);
  const nextNights = parseNightsFromForm(formData);

  const labels = {
    unitTypeLabel: nonEmptyString(formData.unitTypeLabel),
    requestTypeLabel: nonEmptyString(formData.requestTypeLabel),
    genderLabel: resolveStoredGenderSummary(formData),
    allocationTypeLabel: nonEmptyString(formData.allocationTypeLabel),
  };
  const units = parseStoredUnits(saved?.selectedUnits);
  const hasLabels = Object.values(labels).some(Boolean);
  if (hasLabels || units.length > 0) {
    setStoredInquiry({ ...labels, units });
  } else {
    setStoredInquiry(null);
  }

  if (nextStart !== undefined) {
    setValue("startDate", nextStart, { shouldValidate: true });
  }
  if (nextNights !== undefined) {
    setValue("numberOfNights", nextNights, { shouldValidate: true });
  }
}

type ReservationRequestFormProps = {
  applicantName: string;
  companions?: ReservationCompanion[];
  initialStartDate?: string;
  initialNumberOfNights?: number;
  isSubmitting?: boolean;
  /** Called after `addRequest` succeeds (optional parent hook). */
  onSuccess?: (
    values: ReservationRequestFormValues,
    dto: AddRequestDtoPayload,
    requestId?: string,
  ) => Promise<void> | void;
  /** Called after success so the parent can switch to «طلباتى السابقة». */
  onNavigateToHistory?: () => void;
  /** Called after `reservation` is removed from localStorage (e.g. hide this step on the parent). */
  onStorageCleared?: () => void;
};

/** Stable empty list — do not use `companions = []` default (new [] every render → infinite setValue loop). */
const EMPTY_COMPANIONS: ReservationCompanion[] = [];

const PICK_ROW_GUEST_PREFIX = "__pick__:";

function newPickRowKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pickRowPlaceholderGuestId(rowKey: string): string {
  return `${PICK_ROW_GUEST_PREFIX}${rowKey}`;
}

function isPickPlaceholderGuestId(id: string): boolean {
  return id.startsWith(PICK_ROW_GUEST_PREFIX);
}

const COMPANION_SELECT_NONE = "__none__";

type SavedCompanionOption = {
  id: string;
  name: string;
  relationshipId: string;
  relationshipLabel: string;
  gender?: GuestGender;
};

const FALLBACK_COMPANION_ROLE_LABEL = "مرافق";

function sameGuestRows(
  a: ReservationRequestFormValues["guests"],
  b: ReservationRequestFormValues["guests"],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].name !== b[i].name ||
      a[i].role !== b[i].role
    ) {
      return false;
    }
  }
  return true;
}

function sameStringIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

const ReservationRequestForm = ({
  applicantName,
  companions,
  initialStartDate = "",
  initialNumberOfNights = 1,
  isSubmitting = false,
  onSuccess,
  onNavigateToHistory,
  onStorageCleared,
}: ReservationRequestFormProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [storedInquiry, setStoredInquiry] =
    useState<StoredInquirySnapshot | null>(null);
  const [storedSelectedUnits, setStoredSelectedUnits] = useState<
    ReservationStoredUnitSnapshot[]
  >([]);
  const [inquiryGenders, setInquiryGenders] = useState<GuestGender[]>([]);
  const [applicantGender, setApplicantGender] = useState<
    GuestGender | undefined
  >();
  /** Extra companions chosen from saved account companions (each row removable). */
  const [pickedCompanionRows, setPickedCompanionRows] = useState<
    { rowKey: string; companionId: string }[]
  >([]);
  const [savedCompanionOptions, setSavedCompanionOptions] = useState<
    SavedCompanionOption[]
  >([]);
  const [companionsListFetched, setCompanionsListFetched] = useState(false);
  const guestsSyncSignatureRef = useRef("");

  const companionsInput =
    companions && companions.length > 0 ? companions : EMPTY_COMPANIONS;

  const guests = useMemo(
    () => [
      { id: "applicant", name: applicantName, role: "applicant" as const },
      ...companionsInput.map((companion) => ({
        id: companion.id,
        name: companion.name,
        role: "companion" as const,
      })),
      ...pickedCompanionRows.map((row) => {
        if (!row.companionId.trim()) {
          return {
            id: pickRowPlaceholderGuestId(row.rowKey),
            name: "",
            role: "companion" as const,
          };
        }
        const opt = savedCompanionOptions.find((c) => c.id === row.companionId);
        return {
          id: row.companionId,
          name: opt?.name ?? "",
          role: "companion" as const,
        };
      }),
    ],
    [
      applicantName,
      companionsInput,
      pickedCompanionRows,
      savedCompanionOptions,
    ],
  );

  const relationshipLabelByCompanionId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of savedCompanionOptions) {
      m.set(o.id, o.relationshipLabel);
    }
    return m;
  }, [savedCompanionOptions]);

  const form = useForm<ReservationRequestFormValues>({
    resolver: zodResolver(reservationRequestSchema),
    defaultValues: {
      startDate: initialStartDate,
      numberOfNights: initialNumberOfNights,
      guests,
      selectedGuestIds: guests.length ? [guests[0].id] : [],
    },
  });

  const { getValues, setValue, reset } = form;

  useEffect(() => {
    let cancelled = false;
    void oncePerSession("reservation:companions+relationships", async () => {
      const [relRes, compRes] = await Promise.all([
        getRelationships(),
        getCompanions(),
      ]);
      return { relRes, compRes };
    })
      .then(({ relRes, compRes }) => {
        if (cancelled) return;

        const idToRelLabel = new Map<string, string>();
        if (!(relRes as { error?: string })?.error) {
          for (const o of mapGenericOptions(relRes)) {
            const v = String(o.value ?? "").trim();
            if (v)
              idToRelLabel.set(
                v,
                (o.label ?? "").trim() || FALLBACK_COMPANION_ROLE_LABEL,
              );
          }
        }

        if ((compRes as { error?: string })?.error) {
          setSavedCompanionOptions([]);
          toast({
            variant: "destructive",
            title: "تعذر تحميل المرافقين",
            description:
              (compRes as { message?: string }).message ||
              "حدث خطأ أثناء جلب بيانات المرافقين من الحساب",
          });
          return;
        }
        const list = getLookupArray(compRes)
          .map((raw) => {
            const row = raw as Record<string, unknown>;
            const m = mapCompanionDtoToFormEntry(row);
            const displayName = String(
              m.fullName?.trim() ||
                row.fullName ||
                row.FullName ||
                row.name ||
                row.Name ||
                "",
            ).trim();
            const id = String(m.id ?? row.id ?? row.Id ?? "").trim();
            if (!id || !displayName) return null;
            const rid = m.relationshipId?.trim() ?? "";
            const relationshipLabel = rid
              ? (idToRelLabel.get(rid) ?? FALLBACK_COMPANION_ROLE_LABEL)
              : FALLBACK_COMPANION_ROLE_LABEL;
            const opt: SavedCompanionOption = {
              id,
              name: displayName,
              relationshipId: rid,
              relationshipLabel,
            };
            const gender = resolvePersonGuestGender(row);
            if (gender) opt.gender = gender;
            return opt;
          })
          .filter((x): x is SavedCompanionOption => x != null);
        setSavedCompanionOptions(list);
      })
      .catch(() => {
        if (!cancelled) setSavedCompanionOptions([]);
      })
      .finally(() => {
        if (!cancelled) setCompanionsListFetched(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch companions once per session
  }, []);

  const guestsSignature = useMemo(
    () =>
      guests
        .map((g) => `${g.id}\0${g.name}\0${g.role}`)
        .join("\n"),
    [guests],
  );

  useLayoutEffect(() => {
    if (guestsSyncSignatureRef.current === guestsSignature) return;
    guestsSyncSignatureRef.current = guestsSignature;

    const prevGuests = getValues("guests");
    if (!sameGuestRows(prevGuests, guests)) {
      setValue("guests", guests, { shouldValidate: true });
    }

    const selectedGuestIds = resolveGuestsForReservationValidation(guests).map(
      (g) => g.id,
    );

    const prevSel = getValues("selectedGuestIds");
    if (!sameStringIds(prevSel, selectedGuestIds)) {
      setValue("selectedGuestIds", selectedGuestIds, {
        shouldValidate: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when guest list signature changes only
  }, [guestsSignature]);

  const hydratedFromStorageRef = useRef(false);

  /** Hydrate dates / nights + inquiry snapshot from `reservation` in localStorage (once). */
  useLayoutEffect(() => {
    if (hydratedFromStorageRef.current) return;
    hydratedFromStorageRef.current = true;
    hydrateReservationFromLocalStorage(
      setStoredInquiry,
      setStoredSelectedUnits,
      setInquiryGenders,
      setValue,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    let cancelled = false;
    void oncePerSession("reservation:applicant-user", async () => {
      const userRaw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("user")
          : null;
      if (!userRaw || userRaw === "undefined" || userRaw === "null") {
        return null;
      }
      const user = JSON.parse(userRaw) as { id?: string };
      const id = user?.id ? String(user.id).trim() : "";
      if (!id) return null;
      return getUserById(id);
    })
      .then((res) => {
        if (cancelled || !res || (res as { error?: string })?.error) return;
        const data = (res as { data?: Record<string, unknown> })?.data;
        if (data) {
          setApplicantGender(
            parseGuestGenderStrict(data.gender ?? data.Gender) ??
              resolvePersonGuestGender(data),
          );
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleReloadFromLocalStorage = () => {
    hydratedFromStorageRef.current = false;
    hydrateReservationFromLocalStorage(
      setStoredInquiry,
      setStoredSelectedUnits,
      setInquiryGenders,
      setValue,
    );
    hydratedFromStorageRef.current = true;
  };

  const selectedGuestIds = form.watch("selectedGuestIds");

  const handleSubmit = async (values: ReservationRequestFormValues) => {
    const saved = readReservationFromLocalStorage();
    const units =
      storedSelectedUnits.length > 0
        ? storedSelectedUnits
        : parseStoredReservationUnits(saved?.selectedUnits);
    const inquiry =
      inquiryGenders.length > 0
        ? inquiryGenders
        : parseInquiryGenders(
            saved?.form && typeof saved.form === "object"
              ? (saved.form as Record<string, unknown>)
              : undefined,
          );

    try {
      setIsSaving(true);

      const savedForm =
        saved?.form && typeof saved.form === "object"
          ? (saved.form as ReservationLocalStoragePayload["form"])
          : undefined;
      const inquiryStartYmd = savedForm
        ? parseStartDateFromForm(savedForm)
        : undefined;
      const inquiryNights = savedForm ? parseNightsFromForm(savedForm) : undefined;
      const inquiryDates =
        inquiryStartYmd != null
          ? { startDateYmd: inquiryStartYmd, nights: inquiryNights }
          : undefined;

      const [bedsRes, roomsRes, aptRes] = await Promise.all([
        getAvailableUnits("bed", inquiryDates),
        getAvailableUnits("room", inquiryDates),
        getAvailableUnits("apartment", inquiryDates),
      ]);
      const {
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
      } = await hierarchyFilteredAvailabilityLists({
        bedsRaw: extractAvailabilityList(bedsRes),
        roomsRaw: extractAvailabilityList(roomsRes),
        apartmentsRaw: extractAvailabilityList(aptRes),
        inquiry: inquiryDates,
      });

      const unitsWithGender = enrichUnitsWithApartmentGender(
        units,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
        inquiry,
      );

      const guestsForValidation = getValues("guests");
      const guestsToCheck =
        resolveGuestsForReservationValidation(guestsForValidation);

      let submitApplicantGender = applicantGender;
      if (!submitApplicantGender) {
        try {
          const userRaw =
            typeof window !== "undefined"
              ? window.localStorage.getItem("user")
              : null;
          if (userRaw && userRaw !== "undefined" && userRaw !== "null") {
            const user = JSON.parse(userRaw) as { id?: string };
            const id = user?.id ? String(user.id).trim() : "";
            if (id) {
              const res = await getUserById(id);
              const data = (res as { data?: Record<string, unknown> })?.data;
              if (data && !(res as { error?: string })?.error) {
                submitApplicantGender =
                  parseGuestGenderStrict(data.gender ?? data.Gender) ??
                  resolvePersonGuestGender(data);
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const companionGenderById = new Map<string, GuestGender>();
      for (const c of savedCompanionOptions) {
        if (c.gender) companionGenderById.set(c.id, c.gender);
      }
      for (const c of companionsInput) {
        const g = c.gender
          ? (parseGuestGenderStrict(c.gender) ?? c.gender)
          : undefined;
        if (g) companionGenderById.set(c.id, g);
      }

      const missingCompanionIds = guestsToCheck
        .filter((g) => g.role === "companion")
        .map((g) => g.id)
        .filter((id) => !companionGenderById.has(id));

      if (missingCompanionIds.length > 0) {
        const compRes = await getCompanions();
        if (!(compRes as { error?: string })?.error) {
          for (const raw of getLookupArray(compRes)) {
            const r = raw as Record<string, unknown>;
            const id = String(r.id ?? r.Id ?? "").trim();
            if (!id || !missingCompanionIds.includes(id)) continue;
            const g = resolvePersonGuestGender(r);
            if (g) companionGenderById.set(id, g);
          }
        }
      }

      const validation = validateReservationGuestsAgainstUnits({
        guests: guestsForValidation,
        inquiryGenders: inquiry,
        units: unitsWithGender,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
        getGuestGender: (guestId) => {
          if (guestId === "applicant") return submitApplicantGender;
          return companionGenderById.get(guestId);
        },
      });

      if (!validation.ok) {
        toast({
          variant: "destructive",
          title: "لا يمكن تقديم الطلب",
          description: validation.message,
        });
        return;
      }

      const inquiryForm =
        saved?.form && typeof saved.form === "object"
          ? (saved.form as ReservationInquiryFormSnapshot)
          : undefined;

      const unitsForSubmit = enrichStoredUnitsWithHierarchyIds(
        units,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
      );

      const mapped = mapReservationToAddRequestDto({
        formValues: values,
        inquiryForm,
        units: unitsForSubmit,
      });

      if (!mapped.ok) {
        toast({
          variant: "destructive",
          title: "لا يمكن تقديم الطلب",
          description: mapped.message,
        });
        return;
      }

      const apiRes = await addRequest(mapped.dto);
      const parsed = parseAddRequestApiResult(apiRes);
      if (!parsed.ok) {
        toast({
          variant: "destructive",
          title: "فشل تقديم الطلب",
          description: parsed.message,
        });
        return;
      }

      toast({
        title: "تم تقديم الطلب",
        description: "تم إرسال طلب الإقامة بنجاح.",
      });

      await onSuccess?.(values, mapped.dto, parsed.requestId);
      onNavigateToHistory?.();

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(RESERVATION_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      setStoredInquiry(null);
      setStoredSelectedUnits([]);
      setInquiryGenders([]);
      onStorageCleared?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearFormAndStorage = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(RESERVATION_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setStoredInquiry(null);
    setStoredSelectedUnits([]);
    setInquiryGenders([]);
    setPickedCompanionRows([]);
    const clearedGuests = [
      {
        id: "applicant" as const,
        name: applicantName,
        role: "applicant" as const,
      },
      ...companionsInput.map((companion) => ({
        id: companion.id,
        name: companion.name,
        role: "companion" as const,
      })),
    ];
    reset({
      startDate: "",
      numberOfNights: 1,
      guests: clearedGuests,
      selectedGuestIds: clearedGuests.length ? [clearedGuests[0].id] : [],
    });
    onStorageCleared?.();
  };

  const baseGuestCount = 1 + companionsInput.length;

  /** One pick row per saved companion; dropdown hides already-used ids. */
  const canAddCompanionFromSaved = useMemo(() => {
    return (
      savedCompanionOptions.length > 0 &&
      pickedCompanionRows.length < savedCompanionOptions.length
    );
  }, [savedCompanionOptions.length, pickedCompanionRows.length]);

  const addPickedCompanionRow = () => {
    if (!canAddCompanionFromSaved) return;
    setPickedCompanionRows((prev) => [
      ...prev,
      { rowKey: newPickRowKey(), companionId: "" },
    ]);
  };

  const removePickedCompanionRow = (rowKey: string) => {
    setPickedCompanionRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
  };

  const setPickedCompanionForRow = (rowKey: string, companionId: string) => {
    setPickedCompanionRows((prev) =>
      prev.map((r) => (r.rowKey === rowKey ? { ...r, companionId } : r)),
    );
  };

  const selectOptionsForRow = (rowKey: string) => {
    const otherChosen = new Set(
      pickedCompanionRows
        .filter((r) => r.rowKey !== rowKey)
        .map((r) => r.companionId.trim())
        .filter(Boolean),
    );
    return savedCompanionOptions.filter(
      (o) =>
        !companionsInput.some((c) => c.id === o.id) && !otherChosen.has(o.id),
    );
  };

  const relationLabelForGuestRow = (
    guest: ReservationRequestFormValues["guests"][number],
  ) => {
    if (guest.role === "applicant") return "طالب الإقامة";
    if (isPickPlaceholderGuestId(guest.id)) return "—";
    const fromProp = companionsInput.find((c) => c.id === guest.id);
    const fromPropLabel = fromProp?.relationshipLabel?.trim();
    if (fromPropLabel) return fromPropLabel;
    return (
      relationshipLabelByCompanionId.get(guest.id) ??
      FALLBACK_COMPANION_ROLE_LABEL
    );
  };

  const loading = isSubmitting || isSaving;

  const handleInvalidSubmit = () => {
    toast({
      variant: "destructive",
      title: "لا يمكن تقديم الطلب",
      description: "يرجى التحقق من الحقول المطلوبة قبل الإرسال.",
    });
  };

  const currentYear = new Date().getFullYear();
  const maxSelectableDate = new Date(currentYear + 5, 11, 31);
  const minSelectableDate = new Date();
  minSelectableDate.setHours(0, 0, 0, 0);

  return (
    <Card dir="rtl" className="w-full">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">طلب إقامة</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 text-base">
                      تاريخ البدء
                    </FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            dir="rtl"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            disabled={loading}
                            className={cn(
                              "h-[3.75rem] min-h-[3.75rem] w-full justify-between text-right text-base font-normal leading-[3.75rem] bg-white border-2 border-black text-gray-800 hover:bg-gray-50 px-3 py-0",
                              !(field.value ?? "").trim() &&
                                "text-muted-foreground",
                            )}
                          >
                            <span>
                              {(field.value ?? "").trim()
                                ? format(
                                    new Date(`${field.value}T12:00:00`),
                                    "PPP",
                                    { locale: ar },
                                  )
                                : "اختر التاريخ"}
                            </span>
                            <CalendarIcon className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="z-[10002] w-auto p-0 pointer-events-auto"
                          align="start"
                          dir="rtl"
                        >
                          <Calendar
                            mode="single"
                            selected={
                              (field.value ?? "").trim()
                                ? new Date(`${field.value}T12:00:00`)
                                : undefined
                            }
                            onSelect={(date) =>
                              field.onChange(
                                date ? format(date, "yyyy-MM-dd") : "",
                              )
                            }
                            locale={ar}
                            disabled={(date) =>
                              date > maxSelectableDate ||
                              date < minSelectableDate
                            }
                            initialFocus
                            captionLayout="dropdown"
                            toYear={currentYear + 5}
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numberOfNights"
                render={({ field }) => {
                  const raw = field.value as unknown;
                  const display =
                    raw === "" || raw === undefined || raw === null
                      ? ""
                      : String(raw);
                  return (
                    <FormItem>
                      <FormLabel className="text-gray-700 text-base">
                        عدد الليالي
                      </FormLabel>
                      <FormControl>
                        <Input
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          type="number"
                          min={1}
                          readOnly
                          disabled={loading}
                          className="h-[3.75rem] min-h-[3.75rem] cursor-default bg-muted/60 text-base leading-[3.75rem]"
                          value={display}
                          onChange={(event) => {
                            const value = event.target.value;
                            field.onChange(value === "" ? "" : Number(value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {storedInquiry &&
              (storedInquiry.unitTypeLabel ||
                storedInquiry.requestTypeLabel ||
                storedInquiry.genderLabel ||
                storedInquiry.allocationTypeLabel ||
                storedInquiry.units.length > 0) && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
                  {storedInquiry.unitTypeLabel ? (
                    <FormItem>
                      <FormLabel className="text-gray-700 text-base">
                        نوع الوحدة (محفوظ)
                      </FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          value={storedInquiry.unitTypeLabel}
                          className="h-[3.75rem] min-h-[3.75rem] text-base leading-[3.75rem]"
                        />
                      </FormControl>
                    </FormItem>
                  ) : null}
                  {storedInquiry.requestTypeLabel ? (
                    <FormItem>
                      <FormLabel className="text-gray-700 text-base">
                        نوع الطلب (محفوظ)
                      </FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          value={storedInquiry.requestTypeLabel}
                          className="h-[3.75rem] min-h-[3.75rem] text-base leading-[3.75rem]"
                        />
                      </FormControl>
                    </FormItem>
                  ) : null}
                  {storedInquiry.genderLabel ? (
                    <FormItem>
                      <FormLabel className="text-gray-700 text-base">
                        الجنس (محفوظ)
                      </FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          value={storedInquiry.genderLabel}
                          className="h-[3.75rem] min-h-[3.75rem] text-base leading-[3.75rem]"
                        />
                      </FormControl>
                    </FormItem>
                  ) : null}
                  {storedInquiry.allocationTypeLabel ? (
                    <FormItem>
                      <FormLabel className="text-gray-700 text-base">
                        نوع التخصيص (محفوظ)
                      </FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          value={storedInquiry.allocationTypeLabel}
                          className="h-[3.75rem] min-h-[3.75rem] text-base leading-[3.75rem]"
                        />
                      </FormControl>
                    </FormItem>
                  ) : null}
                  {storedInquiry.units.length > 0 ? (
                    <div className="md:col-span-2 space-y-2">
                      <FormLabel className="text-gray-700 text-base">
                        الوحدات المختارة (محفوظ)
                      </FormLabel>
                      <ul className="list-inside list-disc space-y-1 text-base">
                        {storedInquiry.units.map((u, index) => (
                          <li key={`${index}-${u.title}`}>
                            {u.title}
                            {u.subtitle ? (
                              <span className="text-muted-foreground">
                                {" "}
                                — {u.subtitle}
                              </span>
                            ) : null}
                            {u.priceLabel ? (
                              <span className="font-semibold text-emerald-800 tabular-nums">
                                {" "}
                                — {u.priceLabel}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

            <FormField
              control={form.control}
              name="selectedGuestIds"
              render={() => (
                <FormItem>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel className="text-gray-700 text-base m-0">
                      أسماء طالب الإقامة والمرافقين
                    </FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        loading ||
                        !companionsListFetched ||
                        !canAddCompanionFromSaved
                      }
                      className="shrink-0 gap-1 border-2 border-black text-base"
                      onClick={addPickedCompanionRow}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      إضافة مرافق
                    </Button>
                  </div>
                  {!companionsListFetched ? (
                    <p className="text-sm text-muted-foreground">
                      جاري تحميل قائمة المرافقين من الحساب...
                    </p>
                  ) : null}
                  {companionsListFetched && !canAddCompanionFromSaved ? (
                    <p className="text-sm text-muted-foreground">
                      {savedCompanionOptions.length === 0
                        ? "لا يوجد مرافقون محفوظون في الحساب. أضف مرافقين من تبويب المرافقين في الحساب أولاً."
                        : pickedCompanionRows.length >=
                            savedCompanionOptions.length
                          ? "تم الوصول إلى الحد الأقصى لصفوف المرافقين. اختر مرافقاً من القائمة أو احذف صفاً لإضافة آخر."
                          : "تمت إضافة كل المرافقين المحفوظين في الجدول."}
                    </p>
                  ) : null}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right text-base">
                            اختيار
                          </TableHead>
                          <TableHead className="text-right text-base">
                            الاسم
                          </TableHead>
                          <TableHead className="text-right text-base">
                            صلة القرابة
                          </TableHead>
                          <TableHead className="w-[4.5rem] text-center text-base p-2">
                            حذف
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guests.map((guest, index) => {
                          const isBaseRow = index < baseGuestCount;
                          const pickRow = !isBaseRow
                            ? pickedCompanionRows[index - baseGuestCount]
                            : undefined;
                          const rowReactKey = isBaseRow
                            ? guest.id
                            : (pickRow?.rowKey ?? `row-${index}`);

                          return (
                            <TableRow key={rowReactKey}>
                              <TableCell className="text-base">
                                <input
                                  type="checkbox"
                                  checked={selectedGuestIds.includes(guest.id)}
                                  disabled
                                  className="h-4 w-4 shrink-0 cursor-default rounded border-slate-400 opacity-80"
                                />
                              </TableCell>
                              <TableCell className="text-base">
                                {pickRow ? (
                                  <Select
                                    dir="rtl"
                                    value={
                                      pickRow.companionId.trim()
                                        ? pickRow.companionId
                                        : COMPANION_SELECT_NONE
                                    }
                                    onValueChange={(v) =>
                                      setPickedCompanionForRow(
                                        pickRow.rowKey,
                                        v === COMPANION_SELECT_NONE ? "" : v,
                                      )
                                    }
                                    disabled={loading}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "h-10 min-h-10 border-2 border-black text-base text-right [&>span]:w-full [&>span]:text-right",
                                        !pickRow.companionId.trim() &&
                                          "text-muted-foreground",
                                      )}
                                    >
                                      <SelectValue placeholder="اختر مرافقاً محفوظاً" />
                                    </SelectTrigger>
                                    <SelectContent
                                      className="text-right max-h-60"
                                      dir="rtl"
                                    >
                                      <SelectItem
                                        value={COMPANION_SELECT_NONE}
                                        className="text-right"
                                      >
                                        اختر مرافقاً محفوظاً…
                                      </SelectItem>
                                      {selectOptionsForRow(pickRow.rowKey).map(
                                        (o) => (
                                          <SelectItem
                                            key={o.id}
                                            value={o.id}
                                            className="text-right"
                                          >
                                            {o.name} — {o.relationshipLabel}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  guest.name
                                )}
                              </TableCell>
                              <TableCell className="text-base">
                                {relationLabelForGuestRow(guest)}
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                {pickRow ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={loading}
                                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() =>
                                      removePickedCompanionRow(pickRow.rowKey)
                                    }
                                    aria-label="حذف الصف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                className="min-w-32 gap-2 text-base"
                onClick={handleReloadFromLocalStorage}
              >
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                تحديث من التخزين المحلي
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className="min-w-32 border-destructive/40 text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleClearFormAndStorage}
              >
                مسح البيانات وحذف الحفظ
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="min-w-32 text-base"
              >
                {loading ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : null}
                تقديم الطلب
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ReservationRequestForm;
