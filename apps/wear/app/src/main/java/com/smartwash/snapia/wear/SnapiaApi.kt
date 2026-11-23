package com.smartwash.snapia.wear

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/** An API failure: the code of { error: { code } }, or NETWORK_ERROR when Snapia is out of reach. */
class ApiException(val status: Int, val code: String) : Exception(code)

data class Space(val id: String, val name: String, val mode: String, val snapCount: Int)

data class Snap(
    val id: String,
    val thumbnailUrl: String,
    val status: String,
    val note: String?,
)

/** One section of a SnapInsight, ready to show: a title (string resource) and its text. */
data class InsightSection(val titleRes: Int?, val text: String)

data class Flashcard(val question: String, val answer: String)

data class QuizQuestion(val prompt: String, val options: List<String>)

data class Quiz(val id: String, val title: String, val questions: List<QuizQuestion>)

data class Post(
    val id: String,
    val author: String,
    val caption: String,
    val imageUrl: String?,
    val likesCount: Int,
    val likedByMe: Boolean,
)

/**
 * The Snapia REST API (docs/api.md), as the web app uses it. The access token lives only in
 * memory: when it expires, the person signs in again.
 */
class SnapiaApi(private val baseUrl: String) {
    @Volatile private var token: String? = null
    private val images = object : LruCache<String, Bitmap>(IMAGE_CACHE_ENTRIES) {}

    private suspend fun call(method: String, path: String, body: JSONObject? = null): Any? =
        withContext(Dispatchers.IO) {
            try {
                val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
                connection.requestMethod = method
                connection.setRequestProperty("Accept", "application/json")
                token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
                if (body != null) {
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
                if (status !in 200..299) {
                    val code = runCatching {
                        JSONObject(text).getJSONObject("error").getString("code")
                    }.getOrDefault("UNKNOWN_ERROR")
                    throw ApiException(status, code)
                }
                if (text.isEmpty()) null else JSONObject(text).opt("data")
            } catch (error: IOException) {
                throw ApiException(0, "NETWORK_ERROR")
            }
        }

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

    private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }

    suspend fun login(identifier: String, password: String) {
        val body = JSONObject().put("identifier", identifier.trim().lowercase()).put("password", password)
        val data = call("POST", "/auth/login", body) as JSONObject
        token = data.getString("accessToken")
    }

    fun logout() {
        token = null
    }

    suspend fun spaces(): List<Space> =
        (call("GET", "/spaces") as JSONArray).objects().map {
            Space(
                id = it.getString("id"),
                name = it.getString("name"),
                mode = it.getString("mode"),
                snapCount = it.getJSONObject("counts").getInt("snaps"),
            )
        }

    suspend fun snaps(spaceId: String): List<Snap> =
        (call("GET", "/spaces/$spaceId/snaps") as JSONArray).objects().map {
            Snap(
                id = it.getString("id"),
                thumbnailUrl = it.getString("thumbnailUrl"),
                status = it.getString("analysisStatus"),
                note = if (it.isNull("note")) null else it.getString("note"),
            )
        }

    /** The analysis of a snap by mode, or an empty list while it has none. */
    suspend fun insight(snapId: String): List<InsightSection> {
        val insight = try {
            call("GET", "/snaps/$snapId/insight") as JSONObject
        } catch (error: ApiException) {
            if (error.code == "INSIGHT_NOT_FOUND") return emptyList()
            throw error
        }
        val data = insight.getJSONObject("data")
        val sections = mutableListOf(InsightSection(null, data.getString("summary")))
        when (insight.getString("mode")) {
            "STUDY" -> {
                val text = data.optString("extractedText")
                if (text.isNotBlank()) sections += InsightSection(R.string.study_text, text)
                val topics = data.getJSONArray("topics").strings()
                if (topics.isNotEmpty()) sections += InsightSection(R.string.study_topics, topics.joinToString(", "))
                val concepts = data.getJSONArray("keyConcepts").objects()
                    .joinToString("\n\n") { "${it.getString("term")}: ${it.getString("definition")}" }
                if (concepts.isNotEmpty()) sections += InsightSection(R.string.study_concepts, concepts)
            }
            "WORK" -> {
                sections += InsightSection(R.string.work_activity, data.getString("activity"))
                sections += InsightSection(R.string.work_progress, data.getString("progressNote"))
                val issues = data.getJSONArray("issues").objects()
                    .joinToString("\n") { "• ${it.getString("description")}" }
                if (issues.isNotEmpty()) sections += InsightSection(R.string.work_issues, issues)
            }
            "CONTENT" -> {
                sections += InsightSection(R.string.content_score, "${data.getInt("qualityScore")}/100")
                val tips = data.getJSONArray("qualityTips").strings().joinToString("\n") { "• $it" }
                if (tips.isNotEmpty()) sections += InsightSection(R.string.content_tips, tips)
                val hashtags = data.getJSONArray("hashtags").strings().joinToString(" ") { "#$it" }
                sections += InsightSection(
                    R.string.content_caption,
                    "${data.getString("suggestedCaption")}\n$hashtags".trim(),
                )
            }
        }
        return sections
    }

    /** The latest analyzed snaps of a Space, at most max_snaps_per_compose. */
    private suspend fun studySnapIds(spaceId: String): JSONArray {
        val max = (call("GET", "/app-config") as JSONObject).getJSONObject("compose").getInt("maxSnaps")
        val ids = snaps(spaceId).filter { it.status == "DONE" }.take(max).map { it.id }
        if (ids.isEmpty()) throw ApiException(409, "NO_ANALYZED_SNAPS")
        return JSONArray(ids)
    }

    suspend fun flashcards(spaceId: String): List<Flashcard> {
        val body = JSONObject().put("snapIds", studySnapIds(spaceId))
        val deck = call("POST", "/spaces/$spaceId/flashcards", body) as JSONObject
        return deck.getJSONArray("cards").objects().map {
            Flashcard(it.getString("question"), it.getString("answer"))
        }
    }

    suspend fun quiz(spaceId: String): Quiz {
        val body = JSONObject().put("snapIds", studySnapIds(spaceId))
        val quiz = call("POST", "/spaces/$spaceId/quizzes", body) as JSONObject
        return Quiz(
            id = quiz.getString("id"),
            title = quiz.getString("title"),
            questions = quiz.getJSONArray("questions").objects().map {
                QuizQuestion(it.getString("prompt"), it.getJSONArray("options").strings())
            },
        )
    }

    /** Scores the answers on the API: the number of correct ones. */
    suspend fun answerQuiz(quizId: String, answers: List<Int>): Int {
        val body = JSONObject().put("answers", JSONArray(answers))
        return (call("POST", "/quizzes/$quizId/attempts", body) as JSONObject).getInt("score")
    }

    suspend fun feed(): List<Post> =
        (call("GET", "/feed") as JSONArray).objects().map {
            val media = it.getJSONArray("media")
            Post(
                id = it.getString("id"),
                author = it.getJSONObject("author").getString("username"),
                caption = it.getString("caption"),
                imageUrl = if (media.length() > 0) media.getJSONObject(0).getString("thumbnailUrl") else null,
                likesCount = it.getInt("likesCount"),
                likedByMe = it.getBoolean("likedByMe"),
            )
        }

    /** Likes the post, or takes the like back: the new state and count. */
    suspend fun toggleLike(postId: String): Pair<Boolean, Int> {
        val state = call("POST", "/posts/$postId/like") as JSONObject
        return state.getBoolean("liked") to state.getInt("likesCount")
    }

    /** A photo from its signed URL, kept in memory while the app runs. */
    suspend fun image(url: String): Bitmap? {
        images.get(url)?.let { return it }
        return withContext(Dispatchers.IO) {
            runCatching { URL(url).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull()
        }?.also { images.put(url, it) }
    }

    private companion object {
        /** Photos kept in memory: a watch shows a handful at a time. */
        const val IMAGE_CACHE_ENTRIES = 40
    }
}
