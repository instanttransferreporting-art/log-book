import { expect, test, type Page } from "@playwright/test";

// Compte créé par le seed dans la base de TEST (logbook_test) — jamais la base de développement.
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "admin@logbook.local", password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!" };
const run = Date.now().toString(36);
const COMPANY = `E2E Société ${run}`;
const CODE = `E${run.slice(-6).toUpperCase()}`;
const USER = { name: `Testeur ${run}`, email: `testeur-${run}@e2e.local`, password: `Pw-${run}-e2e!` };
let companyId = "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Connexion réussie : attend la redirection hors de /login avant toute navigation. */
async function loginOk(page: Page, email: string, password: string) {
  await login(page, email, password);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("parcours critiques", () => {
  test("connexion : mauvais mot de passe refusé, bon mot de passe accepté", async ({ page }) => {
    await login(page, ADMIN.email, "mauvais-mot-de-passe");
    await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
    await loginOk(page, ADMIN.email, ADMIN.password);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("thème : bascule clair → sombre → système et mémorisation", async ({ page }) => {
    await loginOk(page, ADMIN.email, ADMIN.password);
    const html = page.locator("html");
    await page.getByRole("button", { name: /Thème/ }).click();
    const first = await html.getAttribute("data-theme");
    await page.getByRole("button", { name: /Thème/ }).click();
    const second = await html.getAttribute("data-theme");
    expect(new Set([first, second]).size).toBe(2); // clair ↔ sombre
    await page.reload();
    expect(await html.getAttribute("data-theme")).toBe(second); // mémorisé
  });

  test("dashboard : filtres de période et graphiques", async ({ page }) => {
    await loginOk(page, ADMIN.email, ADMIN.password);
    for (const p of ["Aujourd'hui", "Cette semaine", "Ce mois", "Cette année"]) {
      await page.getByRole("link", { name: p, exact: true }).click();
      await expect(page).toHaveURL(/period=/);
      await expect(page.getByRole("heading", { name: "Évolution des enregistrements" })).toBeVisible();
    }
  });

  test("admin : entreprise, catégorie et formulaire (scénarios 1-3)", async ({ page }) => {
    await loginOk(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/companies");
    await page.getByPlaceholder("Nouvelle Société").fill(COMPANY);
    await page.locator('input[name="code"]').fill(CODE);
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible();
    companyId = page.url().split("/").pop()!;

    await page.getByPlaceholder("Factures").fill("Factures");
    await page.getByRole("button", { name: "Ajouter" }).last().click();
    await expect(page.locator('input[name="name"][value="Factures"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Formulaire" })).toBeVisible();

    await page.getByRole("link", { name: "Formulaire" }).click();
    await page.getByRole("button", { name: "Ajouter un champ" }).click();
    await page.locator("input.input").filter({ hasNot: page.locator("[type=hidden]") }).first().waitFor();
    await page.getByText("Nouveau champ 6").first().click();
    await page.locator("input.input").nth(0).waitFor(); await page.getByText("Libellé", { exact: true }).locator("xpath=following-sibling::input").fill("Montant");
    await page.getByRole("button", { name: "Auto" }).click();
    await page.locator("select.input").selectOption("decimal");
    await page.getByRole("button", { name: "Publier une nouvelle version" }).click();
    await expect(page.getByText("Version 2 publiée")).toBeVisible();

    // Colonnes de la liste configurables : on affiche l'objet (masqué par défaut) et on masque « Nom destinataire »
    await page.getByRole("checkbox", { name: "Objet" }).check();
    await page.getByRole("checkbox", { name: "Nom destinataire" }).uncheck();
    await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
    await expect(page.getByText("Colonnes enregistrées.")).toBeVisible();
  });

  test("admin : création d'un utilisateur rattaché à l'entreprise", async ({ page }) => {
    await loginOk(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/users");
    await page.getByText("+ Nouvel utilisateur").click();
    const form = page.locator("details").first();
    await form.locator('input[name="name"]').fill(USER.name);
    await form.locator('input[name="email"]').fill(USER.email);
    await form.locator('input[name="password"]').fill(USER.password);
    await form.getByRole("combobox").first().selectOption({ label: "Manager" });
    await form.locator(`input[name="companyIds"][value="${companyId}"]`).check();
    await form.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByText(USER.email)).toBeVisible();
  });

  test("utilisateur : tiroir de saisie, référence auto, avant/après, détail grisé, modification (scénarios 4-6, 8)", async ({ page }) => {
    await loginOk(page, USER.email, USER.password);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // L'utilisateur ne voit que son entreprise
    await expect(page.getByRole("button", { name: new RegExp(COMPANY, "i") })).toBeVisible();
    await expect(page.getByRole("button", { name: /Instant Transfer/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);

    // Création dans un tiroir (aucune redirection) : date du jour pré-remplie, référence en aperçu
    await page.goto(`/c/${CODE}/factures`);
    const url = page.url();
    await page.getByRole("button", { name: "Nouveau document" }).click();
    const dlg = page.getByRole("dialog");
    const today = new Date().toLocaleDateString("en-CA");
    await expect(dlg.getByLabel(/^Date/)).toHaveValue(today);
    await dlg.getByLabel("Nom émetteur").fill("DIRECTEUR GENERAL");
    await dlg.getByLabel("Entreprise", { exact: true }).fill("ORANGE CAMEROUN S A");
    await dlg.getByLabel("Nom destinataire").fill("ETOUNDI ANTOINE");
    await dlg.getByLabel("Montant").fill("1500.75");
    await expect(dlg.locator(".font-mono")).toContainText(/^N°0001\/FAC\/DG\/.+\/EA\/OCSA\/\d{4}\/\d{4}$/);
    await dlg.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page).toHaveURL(url); // pas de redirection

    // Détail : champs grisés, bouton Modifier pour qui en a le droit
    await expect(dlg.getByText(/enregistré —/)).toBeVisible();
    const reference = (await dlg.locator(".font-mono").first().innerText()).trim();
    expect(reference).toMatch(/^N°0001\/FAC\//);
    await expect(dlg.getByLabel("Nom émetteur")).toBeDisabled();
    await dlg.getByRole("button", { name: "Modifier" }).click();
    await expect(dlg.getByLabel("Nom émetteur")).toBeEnabled();
    await dlg.getByLabel("Objet").fill("Facture e2e");
    await dlg.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dlg.getByText("Modifications enregistrées")).toBeVisible();
    await expect(dlg.locator(".font-mono").first()).toHaveText(reference); // référence conservée
    await page.keyboard.press("Escape");

    // Ligne dans le tableau + « Avant » : date pré-remplie, numéro suivant, l'existant ne bouge pas
    await expect(page.getByRole("button", { name: reference })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Objet" })).toHaveCount(1); // colonne activée par l'admin
    await expect(page.getByRole("columnheader", { name: "Nom destinataire" })).toHaveCount(0); // colonne masquée par l'admin
    await page.getByRole("button", { name: /Créer avant le n° 1$/ }).click();
    await expect(dlg.getByText(/à insérer avant le n° 0001/)).toBeVisible();
    await dlg.getByLabel(/^Date/).fill("2026-03-05");
    await dlg.getByLabel("Objet").fill("Facture antérieure");
    await dlg.getByLabel("Montant").fill("10");
    await expect(dlg.locator(".font-mono")).toContainText(/^N°0002\/FAC\/.*\/0503\/2026$/);
    await dlg.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dlg.getByText(/n° 0002 enregistré/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(reference).first()).toBeVisible(); // la référence n°1 est inchangée

    // Brouillon sans champs obligatoires
    await page.getByRole("button", { name: "Nouveau document" }).click();
    await dlg.getByLabel("Nom émetteur").fill("BROUILLON");
    await dlg.getByLabel(/^Date/).fill("");
    await dlg.getByRole("button", { name: "Brouillon" }).click();
    await expect(dlg.getByText("Brouillon").first()).toBeVisible();
    await page.keyboard.press("Escape");

    // Recherche (scénario 5)
    await page.goto(`/c/${CODE}/factures?q=${encodeURIComponent("Facture e2e")}`);
    await expect(page.getByText("1 résultat(s)")).toBeVisible();

    // Export CSV (scénario 8)
    const catId = await page.locator('input[name="category"]').inputValue();
    const res = await page.request.get(`/api/export?category=${catId}&format=csv&q=${encodeURIComponent("Facture e2e")}`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Facture e2e");

    // Isolation (scénario 6) : une autre entreprise est introuvable, l'admin interdit
    const other = await page.goto("/c/IT/courrier-sortant");
    expect(other?.status()).toBe(404);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toHaveCount(0);
  });

  test("admin : l'historique trace la création du document (scénario 9)", async ({ page }) => {
    await loginOk(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/audit?action=document.");
    await expect(page.getByRole("row").filter({ hasText: "document.create" }).filter({ hasText: USER.name }).first()).toBeVisible();
  });
});
