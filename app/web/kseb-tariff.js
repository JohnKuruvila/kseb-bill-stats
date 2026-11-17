/* KSEB LT-1A domestic tariff engine.
 * Shared by the public bill calculator / solar estimator pages and the app.
 * Figures follow the KERC LT-1A domestic schedule; verify against the latest
 * KERC tariff order before relying on them.
 */
(function (global) {
  "use strict";

  var TARIFF_VERSION = "KERC LT-1A domestic (bi-monthly)";
  var TARIFF_UPDATED = "2026-10";

  var TELESCOPIC_SLABS = [
    { size: 80, rate: 3.5, label: "0 - 80 Units" },
    { size: 80, rate: 4.2, label: "81 - 160 Units" },
    { size: 40, rate: 4.8, label: "161 - 200 Units" },
    { size: 80, rate: 5.8, label: "201 - 280 Units" },
    { size: 20, rate: 6.6, label: "281 - 300 Units" },
    { size: 100, rate: 7.3, label: "301 - 400 Units" },
    { size: 100, rate: 8.4, label: "401 - 500 Units" },
  ];

  var NON_TELESCOPIC_SLABS = [
    { max: 600, rate: 6.6, label: "501 - 600 Units (Non-Telescopic)" },
    { max: 700, rate: 7.3, label: "601 - 700 Units (Non-Telescopic)" },
    { max: 800, rate: 7.9, label: "701 - 800 Units (Non-Telescopic)" },
    { max: 1000, rate: 8.8, label: "801 - 1000 Units (Non-Telescopic)" },
    { max: Infinity, rate: 9.5, label: "Above 1000 Units (Non-Telescopic)" },
  ];

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function calculateDomesticBill(units, isThreePhase) {
    isThreePhase = !!isThreePhase;
    units = Math.max(0, parseFloat(units) || 0);

    var slabsBreakdown = [];
    var energyCharge = 0;
    var fixedCharge = 0;
    var isTelescopic = true;

    if (units <= 500) {
      isTelescopic = true;
      var remaining = units;
      for (var i = 0; i < TELESCOPIC_SLABS.length; i += 1) {
        if (remaining <= 0) break;
        var slab = TELESCOPIC_SLABS[i];
        var taken = Math.min(remaining, slab.size);
        var subtotal = round2(taken * slab.rate);
        energyCharge += subtotal;
        slabsBreakdown.push({ label: slab.label, units: taken, rate: slab.rate, subtotal: subtotal });
        remaining -= taken;
      }

      if (units <= 80) fixedCharge = isThreePhase ? 180 : 70;
      else if (units <= 160) fixedCharge = isThreePhase ? 200 : 100;
      else if (units <= 200) fixedCharge = isThreePhase ? 240 : 140;
      else if (units <= 280) fixedCharge = isThreePhase ? 280 : 180;
      else if (units <= 300) fixedCharge = isThreePhase ? 300 : 200;
      else if (units <= 400) fixedCharge = isThreePhase ? 320 : 220;
      else fixedCharge = isThreePhase ? 360 : 260;
    } else {
      isTelescopic = false;
      var rate = NON_TELESCOPIC_SLABS[0].rate;
      var slabLabel = NON_TELESCOPIC_SLABS[0].label;
      fixedCharge = isThreePhase ? 380 : 280;

      for (var j = 0; j < NON_TELESCOPIC_SLABS.length; j += 1) {
        var nonTele = NON_TELESCOPIC_SLABS[j];
        if (units <= nonTele.max) {
          rate = nonTele.rate;
          slabLabel = nonTele.label;
          var fixedByBand = [isThreePhase ? 380 : 280, isThreePhase ? 400 : 300, isThreePhase ? 420 : 320, isThreePhase ? 450 : 350, isThreePhase ? 480 : 380];
          fixedCharge = fixedByBand[j];
          break;
        }
      }

      energyCharge = round2(units * rate);
      slabsBreakdown.push({ label: slabLabel, units: units, rate: rate, subtotal: energyCharge });
    }

    var fuelSurcharge = round2(units * 0.1);
    var duty = round2(energyCharge * 0.1);
    var meterRent = isThreePhase ? 35 : 14;
    var otherCharges = round2(fuelSurcharge + duty + meterRent);
    var totalBill = round2(energyCharge + fixedCharge + otherCharges);
    var effectiveRate = units > 0 ? (totalBill / units).toFixed(2) : "0.00";

    return {
      units: units,
      isThreePhase: isThreePhase,
      isTelescopic: isTelescopic,
      energyCharge: Math.round(energyCharge),
      fixedCharge: fixedCharge,
      fuelSurcharge: fuelSurcharge,
      duty: duty,
      meterRent: meterRent,
      otherCharges: Math.round(otherCharges),
      totalBill: Math.round(totalBill),
      effectiveRate: effectiveRate,
      slabsBreakdown: slabsBreakdown,
    };
  }

  function calculateSolarNetMetering(generation, demand) {
    generation = Math.max(0, parseFloat(generation) || 0);
    demand = Math.max(0, parseFloat(demand) || 0);

    var selfConsumed = Math.round(Math.min(generation, demand * 0.45));
    var exportUnits = Math.round(Math.max(0, generation - selfConsumed));
    var importUnits = Math.round(Math.max(0, demand - selfConsumed));

    var netUnits = importUnits - exportUnits;
    var isSurplus = netUnits <= 0;
    var surplusBanked = isSurplus ? Math.abs(netUnits) : 0;
    var billedUnits = !isSurplus ? netUnits : 0;

    var baselineBill = calculateDomesticBill(demand, false).totalBill;
    var solarBill = calculateDomesticBill(billedUnits, false).totalBill;
    var estimatedSavings = Math.max(0, baselineBill - solarBill);
    var coveragePercent = demand > 0 ? Math.min(Math.round((generation / demand) * 100), 100) : 0;

    return {
      generation: generation,
      demand: demand,
      selfConsumed: selfConsumed,
      exportUnits: exportUnits,
      importUnits: importUnits,
      isSurplus: isSurplus,
      surplusBanked: surplusBanked,
      billedUnits: billedUnits,
      estimatedSavings: estimatedSavings,
      coveragePercent: coveragePercent,
    };
  }

  global.KSEBTariff = {
    TARIFF_VERSION: TARIFF_VERSION,
    TARIFF_UPDATED: TARIFF_UPDATED,
    TELESCOPIC_SLABS: TELESCOPIC_SLABS,
    NON_TELESCOPIC_SLABS: NON_TELESCOPIC_SLABS,
    calculateDomesticBill: calculateDomesticBill,
    calculateSolarNetMetering: calculateSolarNetMetering,
  };
})(typeof window !== "undefined" ? window : this);
