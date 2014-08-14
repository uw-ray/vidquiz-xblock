function VideoQuiz(runtime, element) {

    var vid_url = ""; // url to the video being displayed
    var vid_duration = 0;
    var cue_times = []; // store cue times for each quiz question
    var quiz_loaded = false; // was the quiz loaded?
    var icon_correct = "";
    var icon_incorrect = "";
    var cur_question_kind = "";
    var cur_explanation = "";

    /*
    Resets question form to a blank state
    */
    function quizFormReset() {

        // Clear fields and reset their visibility
        $(".student_answer").empty();
        $(".question").text("");
        $(".answer").text("");
        $(".tries").text("").show();
        $(".btn_submit").val("Submit").show();
        $(".btn_next").val("Skip");
        $(".btn_explain").hide();
        $(".answer_icon").hide();
        $(".answer_feedback").hide();

    }

    /* Display quiz questions (taking student results into calculation) */
    function drawQuestions(quiz_content) {

        // First draw student input form
        var params = {type: cur_question_kind};
        $(".student_answer").empty();

        // Just a simple answer
        if (cur_question_kind == "text") {

            params['class'] = "answer_simple";

            if (quiz_content.result >= 2) {
                params['disabled'] = true;
                params['value'] = quiz_content.answer;
            }

            $(".student_answer").append(
                $("<p>").append(
                    $("<input />", params)
                )
            );

        // Student may choose from an array of answers
        } else if (cur_question_kind == "radio" || cur_question_kind == "checkbox") {

            params['name'] = 'answer_multi';

            $.each(quiz_content.options, function() {

                params['value'] = this;
                params['checked'] = false;

                if (quiz_content.result >= 2) {
                    params['disabled'] = true;
                    if ($.inArray(String(this), quiz_content.answer) > -1) params['checked'] = true;
                }

                $(".student_answer").append(
                    $("<ul>").append(
                        $("<li>").append(
                            $('<input />', params)
                        ).append(
                            $("<span>").text(this)
                        )
                    )
                );
            });

        // Notify student that there is an error and this question will not work
        } else {

            $(".question").text("Invalid question type for question ID=" + quiz_content.index + ". Please contact your" +
                " professor.");
            $(".btn_submit").hide();
            $(".tries").hide();

        }

    }

    /* Update contents of quiz field to those received from quiz_content */
    function quizUpdate(quiz_content) {

        /*
        Question states being used below:
               0 = student did not touch this question yet
               1 = failed, with tries left
               2 = tries ran out; will fail; used for initial feedback; will be set to 4 afterwards
               3 = passed; used for initial feedback; will be set to 5 afterwards
               4 = failed, with no tries left
               5 = passed
        */

        quizFormReset(); // refresh quiz form; not the most optimal way, but it does the job

        cur_question_kind = quiz_content.kind;
        cur_explanation = quiz_content.explanation;

        $('.index', element).text(quiz_content.index);
        $('.question', element).text(quiz_content.question);

        drawQuestions(quiz_content);

        // Display feedback if student already attempted or completed this question
        if (quiz_content.result >= 4) {

            $('.btn_submit').hide();
            $('.btn_next').val("Continue");
            $('.tries').hide();

            if (quiz_content.result == 4) out = "You have already attempted this question.";
            else out = "You have already answered this question.";

            $(".answer_feedback").show().text(out);

        // Question isn't a "finalized" stage yet
        } else {

            // Right answer
            if (quiz_content.result == 3) {

                $(".answer_icon").show().attr("src", icon_correct);
                $(".answer_feedback").show().text("Your answer is correct!");
                $('.tries').hide();
                $('.btn_submit').hide();
                $('.btn_next').val("Continue");
                drawQuestions(quiz_content);

            // Wrong answer
            } else if (quiz_content.result == 1) {

                $(".answer_icon").show().attr("src", icon_incorrect);
                $(".answer_feedback").show().text("Sorry, your answer is not correct!");
                $(".btn_submit").val("Resubmit");
                $('.btn_next').val("Continue");

            // Ran out of trie state
            } else if (quiz_content.result == 2) {

                $(".tries").text("Sorry, you ran out of tries.");
                $(".btn_submit").hide();
                $(".btn_next").val("Continue");

            }

            // Output tries left - disabled
            // if (quiz_content.student_tries > 0) $(".tries").text("Tries left: " + quiz_content.student_tries);

        }

        // Conditions for showing Explanation button
        if (quiz_content.student_tries == 0 || quiz_content.result >= 3) {
            $(".btn_explain").show();
        }

    }

    /* Begin quiz session */
    function getToWork(eventObject) {

        // Load quiz questions and grab their cue times
        $.ajax({
            type: "POST",
            url: runtime.handlerUrl(element, "get_to_work"),
            data: JSON.stringify({}),
            async: false,
            success: function(result) {
                console.log(result.vid_url);
                vid_url = result.vid_url;
                cue_times = result.cuetimes;
                quiz_loaded = result.quiz_loaded;
                icon_correct = result.correct;
                icon_incorrect = result.incorrect;
            }

        });

    }

    /* Load question at index i, from vidquiz.py->self.quiz */
    function quizGoto(index, eventObject) {
        $.ajax({
            type: "POST",
            url: runtime.handlerUrl(element, "index_goto"),
            data: JSON.stringify({"index": index}),
            success: quizUpdate
        });
    }

    /* Page is loaded. Do something. */
    $(function($) {

        // Load quiz questions and grab their cue times
        getToWork();

        // Load Popcorn js

        $.getScript("http://cdn.popcornjs.org/code/dist/popcorn-complete.min.js", function(){

            // Popcorn object that affects video lecture

            // Code below is for direct links to video files - no longer used
            // var corn = Popcorn(".vid_lecture");

            var wrapper = Popcorn.HTMLYouTubeVideoElement(".vid_lecture");
            wrapper.src = vid_url + "?controls=0";
            var corn = Popcorn(wrapper);

// remove this
corn.mute();

            // Add statistics to be show at the end of the video
            corn.cue(0.001, function() {

                // Not the most elegant way to do this, but there is no direct way to grab duration
                corn.cue(this.duration()-1.5, function() {

                    $.ajax({
                        type: "POST",
                        url: runtime.handlerUrl(element, "grab_grade"),
                        data: JSON.stringify({}),
                        success: function(result) {

                            if (result.grade != -1) {
                                $('.video_area').hide();
                                $('.quiz_area').hide();
                                $('.scoreboard').show();
                                $('.result_feedback').text("You have correctly answered " + result.grade + "% of the questions.");
                            }

                        }
                    });

                });

            });

            // Set trigger times for each quiz question, and attach controls the quiz
            //elements (ie buttons, text field, etc)
            Popcorn.forEach(cue_times, function (v, k, i) {
                corn.cue(v, function () {
                    corn.pause();
                    $(".vid_lecture").hide();
                    //$(".html5link").hide();
                    $(".quiz_area").show();
                    quizGoto(k);
                });
            });

            // Clicked Submit/Resubmit
            $('.btn_submit').click(function (eventObject) {

                var out = [];

                if (cur_question_kind == "text") {
                    out = $('.answer_simple').val();
                }

                if (cur_question_kind == "checkbox") {
                    out = $('input:checkbox').serializeArray();
                }

                if (cur_question_kind == "radio") {
                    out = $('input:radio').serializeArray();
                    if (out.length == 0) out = "blank"; // still need to pass something to the server
                }

                $.ajax({
                    type: "POST",
                    url: runtime.handlerUrl(element, 'answer_submit'),
                    data: JSON.stringify({
                        "answer": out
                    }),
                    success: quizUpdate
                });

            });

            // Clicked Skip/Continue
            $('.btn_next').click(function (eventObject) {
                $(".vid_lecture").show();
                //$(".html5link").show();
                $(".quiz_area").hide();
                corn.play();
            });

            // Clicked Explain button
            $('.btn_explain').click(function(eventObject) {

                // change in the future; this implementation is the bare minimum

                function openindex()
                {
                OpenWindow=window.open("", "newwin", "height=250, width=640,toolbar=no,scrollbars="+scroll+",menubar=no");
                OpenWindow.document.write("<TITLE>Explanation</TITLE>");
                OpenWindow.document.write("<BODY BGCOLOR=gray>");
                OpenWindow.document.write(cur_explanation);
                OpenWindow.document.write("<FORM>");
                OpenWindow.document.write("<INPUT TYPE='BUTTON' VALUE='Close Window' onClick='window.close()'>");
                OpenWindow.document.write("</FORM>");
                OpenWindow.document.write("</BODY>");
                OpenWindow.document.write("</HTML>");
                OpenWindow.document.close();
                self.name="main"
                }
                openindex();

            });

            // Clicked Replay button
            $('.btn_replay').click(function(eventObject) {

                $.ajax({
                    type: "POST",
                    url: runtime.handlerUrl(element, 'quiz_reset'),
                    data: JSON.stringify({}),
                    success: function(eventObject) {
                        quizFormReset();
                        $('.video_area').show();
                        $('.quiz_area').hide();
                        $('.scoreboard').hide();
                        corn.currentTime(0);
                        corn.play();
                    }
                });

            });

        });

    });

}
