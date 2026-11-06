# Publishing checklist

Everything in this repository is public, and everything merged to `main` deploys to https://tsmlabmsu.com. Check every change against this list before it is committed, pushed or merged. This applies to people and to AI agents working in the repo.

## Rules

1. **No third-party figures, insets or photos.** Use one only when it is absolutely necessary and its reuse is permitted; record the permission next to where it is used. Otherwise remove it. This includes panels or insets taken from other groups' papers ("Author et al. YEAR"), publisher figures, and stock images.
2. **No identifying image metadata.** No camera or lens serial numbers, capture timestamps, GPS location, maker notes, editing-software history or author fields in any image file. Strip EXIF, XMP, IPTC, PNG text and time chunks before committing (for example `exiftool -all= --ICC_Profile:all --Adobe:all --JFIF:all <file>`). Color profiles (ICC) may stay.
3. **No secrets.** No `.env` files, API keys, tokens, passwords, private keys or certificates. Secrets are read at runtime from outside the repo.
4. **No personal contact data.** Only work contact details (university email, office address, lab phone). No personal email addresses, phone numbers or home addresses.
5. **No student records.** No grades, evaluations, application materials, ID numbers or other FERPA-protected information.
6. **No unpublished or draft work.** Only published papers, accepted manuscripts and material the authors have released.
7. **No retracted wording.** Wording the owner has withdrawn stays withdrawn. Its hashes are listed in `scripts/retracted-phrases.txt`; add new ones with `node scripts/check-publish.mjs --hash "<phrase>"`.

## Automated check

`npm run check:publish` scans every tracked file and fails on image metadata outside the allowlist, secret files and token patterns, files over 5 MB, retracted wording, and images in `src/assets/images/` that no source file references (the repo is public, and every image in `src/assets/images/research/` is copied to the live site, so an unused image is still published). CI runs it before every build and before every deploy. Rules 1, 4, 5 and 6 need a person's review; the check cannot judge them.
