<?php

namespace App\Http\Controllers;

use App\Models\Klant;
use Illuminate\Http\Request;
use Inertia\Inertia;

class KlantController extends Controller
{
    public function index()
    {
        // Haal alle klanten op
        $klanten = Klant::all();

        // Stuur ze naar een Inertia view, bijv. 'Klanten/Index'
        return Inertia::render('Klanten/Index', [
            'klanten' => $klanten
        ]);
    }

    public function create()
    {
        // Toon een form voor nieuwe klant
        return Inertia::render('Klanten/Create');
    }

    public function store(Request $request)
    {
        // Valideer input
        $data = $request->validate([
            'voornaam' => 'required|string|max:255',
            'achternaam' => 'nullable|string|max:255',
            'adres' => 'nullable|string|max:255',
            'postcode' => 'nullable|string|max:20',
            'woonplaats' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'telefoon' => 'nullable|string|max:50',
            'website' => 'nullable|url|max:255',
        ]);

        // Maak klant aan in database
        Klant::create($data);

        // Redirect terug naar de index pagina
        return redirect()->route('klanten.index')->with('success', 'Klant aangemaakt!');
    }

    public function edit(Klant $klant)
    {
        // Toon een form om bestaande klant te bewerken
        return Inertia::render('Klanten/Edit', [
            'klant' => $klant
        ]);
    }

    public function update(Request $request, Klant $klant)
    {
        // Valideer input
        $data = $request->validate([
            'voornaam' => 'required|string|max:255',
            'achternaam' => 'nullable|string|max:255',
            'adres' => 'nullable|string|max:255',
            'postcode' => 'nullable|string|max:20',
            'woonplaats' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'telefoon' => 'nullable|string|max:50',
            'website' => 'nullable|url|max:255',
        ]);

        // Update klant
        $klant->update($data);

        return redirect()->route('klanten.index')->with('success', 'Klant bijgewerkt!');
    }

    public function destroy(Klant $klant)
    {
        // Verwijder de klant
        $klant->delete();

        return redirect()->route('klanten.index')->with('success', 'Klant verwijderd!');
    }
}
