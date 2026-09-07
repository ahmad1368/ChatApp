export const MAX_SELECTED_PETS = 3;

// Hinge's real "Pets" catalog.
export const PET_CATALOG = [
  "dog",
  "cat",
  "bird",
  "fish",
  "reptile",
  "amphibian",
  "otherPet",
  "noPets",
  "petFree",
  "wantAPet",
  "allergicToPets",
] as const;
export type Pet = (typeof PET_CATALOG)[number];

export interface PetsInfo {
  pets: Pet[];
  // Same "show a detail while letting people hide it" privacy option as
  // #67-#74's other profile-detail hide flags.
  hidePets: boolean;
}

export type UpdatePetsInfoResult = { success: true; petsInfo: PetsInfo } | { success: false; error: string };

function isPet(value: unknown): value is Pet {
  return typeof value === "string" && (PET_CATALOG as readonly string[]).includes(value);
}

const EMPTY_PETS_INFO: PetsInfo = { pets: [], hidePets: false };

/**
 * Editable-anytime pet status (#75), same one-value-per-author,
 * replace-on-update shape as #67-#74's other standalone profile fields. Up
 * to 3 selections from a fixed catalog, same fixed-catalog pattern as #73's
 * languages.
 */
export class PetsInfoStore {
  private infoByAuthor = new Map<string, PetsInfo>();

  update(author: unknown, pets: unknown, hidePets: unknown): UpdatePetsInfoResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(pets)) {
      return { success: false, error: "pets must be a list" };
    }
    if (pets.length > MAX_SELECTED_PETS) {
      return { success: false, error: `Choose at most ${MAX_SELECTED_PETS} pet options` };
    }

    const seen = new Set<Pet>();
    for (const entry of pets) {
      if (!isPet(entry)) {
        return { success: false, error: "Invalid pet option selected" };
      }
      if (seen.has(entry)) {
        return { success: false, error: "Each pet option can only be selected once" };
      }
      seen.add(entry);
    }

    const petsInfo: PetsInfo = { pets: [...seen], hidePets: hidePets === true };
    this.infoByAuthor.set(authorName, petsInfo);
    return { success: true, petsInfo };
  }

  get(author: string): PetsInfo {
    return this.infoByAuthor.get(author) ?? EMPTY_PETS_INFO;
  }
}
