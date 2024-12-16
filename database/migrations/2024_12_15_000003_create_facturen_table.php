<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateFacturenTable extends Migration
{
    public function up()
    {
        Schema::create('facturen', function (Blueprint $table) {
            $table->id(); // factuur_id
            $table->string('factuurnummer')->unique();
            $table->date('factuurdatum')->nullable();
            $table->string('onderwerp')->nullable();
            $table->enum('factuur_van', ['daan', 'wim'])->default('daan');
            $table->enum('status', ['concept', 'open', 'betaald', 'geannuleerd'])->default('concept');
            
            // Koppeling naar klant en crediteur
            $table->foreignId('klant_id')->constrained('klanten')->onDelete('cascade');
            $table->foreignId('crediteur_id')->constrained('crediteuren')->onDelete('restrict'); 
            
            $table->decimal('percentage', 5, 2)->default(0.00);
            $table->decimal('subtotaal', 10, 2)->default(0.00);
            $table->decimal('btw_percentage', 5, 2)->default(21.00);
            $table->decimal('btw', 10, 2)->default(0.00);
            $table->decimal('totaal', 10, 2)->default(0.00);
            $table->string('bijlage')->nullable();

            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('facturen');
    }
}
