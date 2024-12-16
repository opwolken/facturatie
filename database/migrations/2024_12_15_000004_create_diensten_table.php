<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDienstenTable extends Migration
{
    public function up()
    {
        Schema::create('diensten', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factuur_id')->constrained('facturen')->onDelete('cascade');
            $table->string('dienst');
            $table->integer('aantal')->default(1);
            $table->decimal('waarde', 10, 2)->default(0.00);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('diensten');
    }
}
