<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Nieuwe klant</h1>

    <form method="POST" action="/klanten">
      <input type="hidden" name="_token" :value="$page.props.csrf_token" />

      <div class="mb-4">
        <label for="voornaam" class="block font-semibold">Voornaam</label>
        <input type="text" id="voornaam" name="voornaam" class="border p-2 w-full" required>
      </div>

      <div class="mb-4">
        <label for="achternaam" class="block font-semibold">Achternaam</label>
        <input type="text" id="achternaam" name="achternaam" class="border p-2 w-full">
      </div>

      <div class="mb-4">
        <label for="email" class="block font-semibold">Email</label>
        <input type="email" id="email" name="email" class="border p-2 w-full">
      </div>

      <div class="mb-4">
        <label for="adres" class="block font-semibold">Adres</label>
        <input type="text" id="adres" name="adres" class="border p-2 w-full">
      </div>

      <div class="mb-4">
        <label for="postcode" class="block font-semibold">Postcode</label>
        <input type="text" id="postcode" name="postcode" class="border p-2 w-full">
      </div>

      <div class="mb-4">
        <label for="woonplaats" class="block font-semibold">Woonplaats</label>
        <input type="text" id="woonplaats" name="woonplaats" class="border p-2 w-full">
      </div>

      <div class="mb-4">
        <label for="telefoon" class="block font-semibold">Telefoon</label>
        <input type="text" id="telefoon" name="telefoon" class="border p-2 w-full">
      </div>

      <div class="mb-4">
        <label for="website" class="block font-semibold">Website</label>
        <input type="url" id="website" name="website" class="border p-2 w-full">
      </div>

      <button class="bg-green-500 text-white px-4 py-2 rounded" type="submit">Opslaan</button>
      <a href="/klanten" class="ml-2">Annuleren</a>
    </form>
  </div>
</template>