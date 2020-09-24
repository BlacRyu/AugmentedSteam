import {Feature} from "modules";

import {HTMLParser, Localization, SyncedStorage} from "core";
import {Background, ExtensionLayer, Messenger, Sortbox} from "common";

export default class FReviewSort extends Feature {

    apply() {

        const numReviewsNode = document.querySelector(".review_stat:nth-child(1) .giantNumber");
        if (!numReviewsNode) { return; }

        const numReviews = Number(numReviewsNode.innerText);
        if (isNaN(numReviews) || numReviews <= 1) { return; }

        const steamId = window.location.pathname.match(/\/((?:id|profiles)\/.+?)\//)[1];
        const params = new URLSearchParams(window.location.search);
        const curPage = params.get("p") || 1;
        const pageCount = 10;
        let reviews;

        async function getReviews() {

            let modalActive = false;

            // Delay half a second to avoid dialog flicker when grabbing cache
            const delayer = setTimeout(
                () => {
                    ExtensionLayer.runInPageContext(
                        (processing, wait) => { ShowBlockingWaitDialog(processing, wait); },
                        [
                            Localization.str.processing,
                            Localization.str.wait
                        ]
                    );
                    modalActive = true;
                },
                500,
            );

            try {
                reviews = await Background.action("reviews", steamId, numReviews);

                reviews.map((review, i) => {
                    review.default = i;
                    return review;
                });
            } finally {
                clearTimeout(delayer);

                if (modalActive) {
                    ExtensionLayer.runInPageContext(() => {
                        CModal.DismissActiveModal();
                    });
                }
            }
        }

        async function sortReviews(sortBy, reverse) {
            if (!reviews) {
                await getReviews();
            }

            for (const node of document.querySelectorAll(".review_box")) {
                node.remove();
            }

            let displayedReviews = reviews.sort((a, b) => {
                switch (sortBy) {
                case "rating":
                case "helpful":
                case "funny":
                case "length":
                case "playtime":
                    return b[sortBy] - a[sortBy];
                case "visibility":
                    a = a[sortBy].toLowerCase();
                    b = b[sortBy].toLowerCase();
                    if (a > b) { return -1; }
                    if (a < b) { return 1; }
                    return 0;
                case "default":
                    return a[sortBy] - b[sortBy];
                }
            });

            if (reverse) {
                displayedReviews.reverse();
            }

            displayedReviews = displayedReviews.slice(pageCount * (curPage - 1), pageCount * curPage);

            const footer = document.querySelector("#leftContents > .workshopBrowsePaging:last-child");
            for (const {node} of displayedReviews) {
                footer.insertAdjacentElement("beforebegin", HTMLParser.htmlToElement(node));
            }

            // Add back sanitized event handlers
            ExtensionLayer.runInPageContext(ids => {
                Array.from(document.querySelectorAll(".review_box")).forEach((node, boxIndex) => {
                    const id = ids[boxIndex];

                    const containers = node.querySelectorAll(".dselect_container");

                    // Only exists when the requested profile is yours (these are the input fields where you can change visibility and language of the review)
                    if (containers.length) {
                        for (const container of node.querySelectorAll(".dselect_container")) {
                            const type = container.id.startsWith("ReviewVisibility") ? "Visibility" : "Language";
                            const input = container.querySelector("input");
                            const trigger = container.querySelector(".trigger");
                            const selections = Array.from(container.querySelectorAll(".dropcontainer a"));

                            input.onchange = () => { window[`OnReview${type}Change`](id, `Review${type}${id}`); };

                            trigger.href = "javascript:DSelectNoop();";
                            trigger.onfocus = () => DSelectOnFocus(`Review${type}${id}`);
                            trigger.onblur = () => DSelectOnBlur(`Review${type}${id}`);
                            trigger.onclick = () => DSelectOnTriggerClick(`Review${type}${id}`);

                            selections.forEach((selection, selIndex) => {
                                selection.href = "javascript:DSelectNoop();";
                                selection.onmouseover = () => DHighlightItem(`Review${type}${id}`, selIndex, false);
                                selection.onclick = () => DHighlightItem(`Review${type}${id}`, selIndex, true);
                            });
                        }

                    // Otherwise you have buttons to vote for the review (Was it helpful or not, was it funny?)
                    } else {
                        const controlBlock = node.querySelector(".control_block");

                        const btns = controlBlock.querySelectorAll("a");
                        const [upvote, downvote, funny] = btns;

                        for (const btn of btns) {
                            btn.href = "javascript:void(0)";
                        }

                        upvote.onclick = () => UserReviewVoteUp(id);
                        downvote.onclick = () => UserReviewVoteDown(id);
                        funny.onclick = () => UserReviewVoteTag(id, 1, `RecommendationVoteTagBtn${id}_1`);
                    }
                });
            }, [displayedReviews.map(review => review.id)]);
        }

        Messenger.addMessageListener("updateReview", id => {
            Background.action("updatereviewnode", steamId, document.querySelector(`[id$="${id}"`).closest(".review_box").outerHTML, numReviews).then(getReviews);
        });

        ExtensionLayer.runInPageContext(() => {
            $J(document).ajaxSuccess((event, xhr, {url}) => {
                const pathname = new URL(url).pathname;
                if (pathname.startsWith("/userreviews/rate/") || pathname.startsWith("/userreviews/votetag/") || pathname.startsWith("/userreviews/update/")) {
                    const id = pathname.split("/").pop();
                    Messenger.postMessage("updateReview", id);
                }
            });
        });

        document.querySelector(".review_list h1").insertAdjacentElement("beforebegin",
            Sortbox.get("reviews", [
                ["default", Localization.str.date],
                ["rating", Localization.str.rating],
                ["helpful", Localization.str.helpful],
                ["funny", Localization.str.funny],
                ["length", Localization.str.length],
                ["visibility", Localization.str.visibility],
                ["playtime", Localization.str.playtime],
            ], SyncedStorage.get("sortreviewsby"), sortReviews, "sortreviewsby"));
    }
}
