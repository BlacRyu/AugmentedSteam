import {ContextTypes, Feature} from "modules";

import {HTML, LocalStorage, Localization, SyncedStorage} from "core";
import {ExtensionLayer} from "common";

export default class FMediaExpander extends Feature {

    checkPrerequisites() {
        this._details = document.querySelector("#game_highlights .rightcol, .workshop_item_header .col_right");
        return this._details !== null;
    }

    apply() {
        let selector = null;

        if (this.context.type === ContextTypes.APP && (SyncedStorage.get("showyoutubegameplay") || SyncedStorage.get("showyoutubereviews"))) {
            selector = ".home_tabs_row";
        } else {
            selector = "#highlight_player_area";
        }

        HTML.beforeEnd(selector,
            `<div class="es_slider_toggle btnv6_blue_hoverfade btn_medium">
                <div data-slider-tooltip="${Localization.str.expand_slider}" class="es_slider_expand"><i class="es_slider_toggle_icon"></i></div>
                <div data-slider-tooltip="${Localization.str.contract_slider}" class="es_slider_contract"><i class="es_slider_toggle_icon"></i></div>
            </div>`);

        // Initiate tooltip
        ExtensionLayer.runInPageContext(() => { $J("[data-slider-tooltip]").v_tooltip({"tooltipClass": "store_tooltip community_tooltip", "dataName": "sliderTooltip"}); });

        const expandSlider = LocalStorage.get("expand_slider", false);
        if (expandSlider) {
            this._buildSideDetails();

            for (const node of document.querySelectorAll(".es_slider_toggle, #game_highlights, .workshop_item_header, .es_side_details, .es_side_details_wrap")) {
                node.classList.add("es_expanded");
            }
            for (const node of document.querySelectorAll(".es_side_details_wrap, .es_side_details")) {

                // shrunk => expanded
                node.style.display = null;
                node.style.opacity = 1;
            }

            // Triggers the adjustment of the slider scroll bar
            setTimeout(() => {
                window.dispatchEvent(new Event("resize"));
            }, 250);
        }

        document.querySelector(".es_slider_toggle").addEventListener("click", (e) => { this._clickSliderToggle(e); });
    }

    _buildSideDetails() {
        if (this._detailsBuilt) { return; }
        this._detailsBuilt = true;

        const details = this._details;
        if (!details) { return; }

        if (details.matches(".rightcol")) {

            // Clone details on a store page
            let detailsClone = details.querySelector(".glance_ctn");
            if (!detailsClone) { return; }
            detailsClone = detailsClone.cloneNode(true);
            detailsClone.classList.add("es_side_details", "block", "responsive_apppage_details_left");

            for (const node of detailsClone.querySelectorAll(".app_tag.add_button, .glance_tags_ctn.your_tags_ctn")) {

                // There are some issues with having duplicates of these on page when trying to add tags
                node.remove();
            }

            const detailsWrap = HTML.wrap(detailsClone, "<div class=\"es_side_details_wrap\"></div>");
            detailsWrap.style.display = "none";
            const target = document.querySelector("div.rightcol.game_meta_data");
            if (target) {
                target.insertAdjacentElement("afterbegin", detailsWrap);
            }
        } else {

            // Clone details in the workshop
            const detailsClone = details.cloneNode(true);
            detailsClone.style.display = "none";
            detailsClone.setAttribute("class", "panel es_side_details");
            HTML.adjacent(detailsClone, "afterbegin", `<div class="title">${Localization.str.details}</div><div class="hr padded"></div>`);
            let target = document.querySelector(".sidebar");
            if (target) {
                target.insertAdjacentElement("afterbegin", detailsClone);
            }

            target = document.querySelector(".highlight_ctn");
            if (target) {
                HTML.wrap(target, "<div class=\"leftcol\" style=\"width: 638px; float: left; position: relative; z-index: 1;\" />");
            }

            /*
             * Don't overlap Sketchfab's "X"
             * Example: https://steamcommunity.com/sharedfiles/filedetails/?id=606009216
             */
            target = document.querySelector(".highlight_sketchfab_model");
            if (target) {
                target = document.getElementById("highlight_player_area");
                target.addEventListener("mouseenter", function() {
                    let el = this.querySelector(".highlight_sketchfab_model");
                    if (!el) { return; }
                    if (el.style.display == "none") { return; }
                    el = document.querySelector(".es_slider_toggle");
                    if (!el) { return; }
                    el.style.top = "32px";
                });
                target.addEventListener("mouseleave", () => {
                    const el = document.querySelector(".es_slider_toggle");
                    if (!el) { return; }
                    el.style.top = null;
                });
            }
        }
    }

    _clickSliderToggle(e) {
        e.preventDefault();
        e.stopPropagation();

        const el = e.target.closest(".es_slider_toggle");
        this._details.style.display = "none";
        this._buildSideDetails();

        // Fade In/Out sideDetails
        const sideDetails = document.querySelector(".es_side_details_wrap, .es_side_details");
        if (sideDetails) {
            if (el.classList.contains("es_expanded")) {

                // expanded => shrunk
                sideDetails.style.opacity = 0;

                setTimeout(() => {

                    // Hide after transition completes
                    if (!el.classList.contains("es_expanded")) {
                        sideDetails.style.display = "none";
                    }
                }, 250);

            } else {

                // shrunk => expanded
                sideDetails.style.display = null;
                sideDetails.style.opacity = 1;
            }
        }

        // On every animation/transition end check the slider state
        const container = document.querySelector(".highlight_ctn");
        container.addEventListener("transitionend", () => { this._saveSlider(); });

        for (const node of document.querySelectorAll(".es_slider_toggle, #game_highlights, .workshop_item_header, .es_side_details, .es_side_details_wrap")) {
            node.classList.toggle("es_expanded");
        }
    }

    _saveSlider() {

        // Save slider state
        LocalStorage.set("expand_slider", el.classList.contains("es_expanded"));
        const details = this._details;

        // If slider was contracted show the extended details
        if (!el.classList.contains("es_expanded")) {
            details.style.transition = "";
            details.style.opacity = "0";
            details.style.transition = "opacity 250ms";
            details.style.display = null;
            details.style.opacity = "1";
        }

        // Triggers the adjustment of the slider scroll bar
        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
        }, 250);
    }
}
