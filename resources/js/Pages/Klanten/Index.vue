<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Klanten</h1>

    <a href="/klanten/create" class="bg-blue-500 text-white px-4 py-2 rounded">Nieuwe klant</a>

    <table class="mt-4 w-full border-collapse">
      <thead>
        <tr class="border-b">
          <th class="p-2 text-left">Voornaam</th>
          <th class="p-2 text-left">Achternaam</th>
          <th class="p-2 text-left">Email</th>
          <th class="p-2 text-left">Acties</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="klant in $page.props.klanten" :key="klant.id" class="border-b">
          <td class="p-2">{{ klant.voornaam }}</td>
          <td class="p-2">{{ klant.achternaam }}</td>
          <td class="p-2">{{ klant.email }}</td>
          <td class="p-2">
            <a :href="`/klanten/${klant.id}/edit`" class="text-blue-500 mr-2">Bewerken</a>
            <form :action="`/klanten/${klant.id}`" method="POST" style="display:inline;">
              <input type="hidden" name="_method" value="DELETE" />
              <input type="hidden" name="_token" :value="$page.props.csrf_token" />
              <button class="text-red-500" type="submit">Verwijderen</button>
            </form>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>