/* Progressive enhancement for the public KSEB tool pages.
 * The default values are pre-rendered in the HTML, so the pages work without
 * JavaScript; this file only keeps the numbers in sync as the user edits.
 */
(function () {
  "use strict";

  var T = window.KSEBTariff;
  if (!T) return;

  function rupee(value) {
    return "₹" + Number(value).toLocaleString("en-IN");
  }

  function initCalculator() {
    var unitsInput = document.getElementById("calcUnitsInput");
    var unitsSlider = document.getElementById("calcUnitsSlider");
    if (!unitsInput || !unitsSlider) return;

    var phaseSingle = document.getElementById("phaseSingleBtn");
    var phaseThree = document.getElementById("phaseThreeBtn");
    var phase = "single";

    function update(units) {
      var result = T.calculateDomesticBill(units, phase === "three");
      var set = function (id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      };
      set("calcTotalBill", rupee(result.totalBill));
      set("calcEffectiveRate", "₹" + result.effectiveRate + " / unit effective");
      set("calcEnergyCharge", rupee(result.energyCharge));
      set("calcSlabTypeBadge", result.isTelescopic ? "Telescopic Slabs" : "Non-Telescopic");
      set("calcFixedCharge", rupee(result.fixedCharge));
      set("calcPhaseSub", phase === "three" ? "Three Phase (3φ)" : "Single Phase (1φ)");
      set("calcDutySurcharge", rupee(result.otherCharges));

      var alertBox = document.getElementById("calcSlabAlert");
      var alertText = document.getElementById("calcSlabAlertText");
      if (alertBox && alertText) {
        if (result.isTelescopic) {
          alertBox.className = "alert info";
          alertText.textContent =
            "Telescopic tariff: up to 500 units bi-monthly, lower slabs are billed at discounted progressive rates.";
        } else {
          alertBox.className = "alert warning";
          alertText.textContent =
            "Non-telescopic threshold exceeded (>500 units): all " + result.units + " units are billed at a flat rate.";
        }
      }

      var body = document.getElementById("calcSlabTableBody");
      if (body) {
        body.innerHTML = result.slabsBreakdown
          .map(function (item) {
            return (
              "<tr><td>" + item.label + "</td><td>" + item.units + " units</td><td>₹" +
              item.rate.toFixed(2) + "</td><td class=\"text-right\">₹" +
              item.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 }) + "</td></tr>"
            );
          })
          .join("");
      }
    }

    unitsInput.addEventListener("input", function (e) {
      var val = Number(e.target.value) || 0;
      unitsSlider.value = Math.min(val, 1000);
      update(val);
    });
    unitsSlider.addEventListener("input", function (e) {
      var val = Number(e.target.value) || 0;
      unitsInput.value = val;
      update(val);
    });
    if (phaseSingle) {
      phaseSingle.addEventListener("click", function () {
        phase = "single";
        phaseSingle.classList.add("is-active");
        phaseThree.classList.remove("is-active");
        update(Number(unitsInput.value) || 0);
      });
    }
    if (phaseThree) {
      phaseThree.addEventListener("click", function () {
        phase = "three";
        phaseThree.classList.add("is-active");
        phaseSingle.classList.remove("is-active");
        update(Number(unitsInput.value) || 0);
      });
    }

    update(Number(unitsInput.value) || 240);
  }

  function initSolar() {
    var genInput = document.getElementById("solarGenInput");
    var demandInput = document.getElementById("solarDemandInput");
    if (!genInput || !demandInput) return;

    function update() {
      var res = T.calculateSolarNetMetering(Number(genInput.value) || 0, Number(demandInput.value) || 0);
      var set = function (id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      };
      set("solarSavingsVal", rupee(res.estimatedSavings));
      set("solarCoverageSub", res.coveragePercent + "% solar coverage");
      set("solarSelfConsumedVal", res.selfConsumed + " kWh");
      set("solarExportVal", res.exportUnits + " kWh");
      var label = document.getElementById("solarNetStatusLabel");
      var value = document.getElementById("solarNetUnitsVal");
      var sub = document.getElementById("solarNetUnitsSub");
      if (label && value && sub) {
        if (res.isSurplus) {
          label.textContent = "Banked Surplus Units";
          value.textContent = "+" + res.surplusBanked + " kWh";
          sub.textContent = "Carried forward to next cycle";
        } else {
          label.textContent = "Net Billed Units";
          value.textContent = res.billedUnits + " kWh";
          sub.textContent = "Payable at standard LT-1A slab rate";
        }
      }
    }

    genInput.addEventListener("input", update);
    demandInput.addEventListener("input", update);
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initCalculator();
      initSolar();
    });
  } else {
    initCalculator();
    initSolar();
  }
})();
