package com.smartwash.snapia.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import androidx.wear.compose.material3.TimeText
import kotlinx.coroutines.launch

/** The screens of the watch app; the last one in the back stack is on screen. */
sealed interface Screen {
    data object Login : Screen
    data object Menu : Screen
    data object Spaces : Screen
    data class SpaceSnaps(val space: Space) : Screen
    data class SnapDetail(val snap: Snap) : Screen
    data class Flashcards(val space: Space) : Screen
    data class QuizScreen(val space: Space) : Screen
    data object Feed : Screen
}

class MainActivity : ComponentActivity() {
    private val api = SnapiaApi(BuildConfig.API_URL)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SnapiaWatch(api) }
    }
}

@Composable
fun SnapiaWatch(api: SnapiaApi) {
    val stack = remember { mutableStateListOf<Screen>(Screen.Login) }
    fun open(screen: Screen) = stack.add(screen)
    // The swipe from the left edge (the watch's back gesture) closes the current screen.
    BackHandler(enabled = stack.size > 1) { stack.removeAt(stack.lastIndex) }

    MaterialTheme {
        AppScaffold(timeText = { TimeText() }) {
            when (val screen = stack.last()) {
                Screen.Login -> LoginScreen(api) { stack.clear(); stack.add(Screen.Menu) }
                Screen.Menu -> MenuScreen(::open) {
                    api.logout()
                    stack.clear()
                    stack.add(Screen.Login)
                }
                Screen.Spaces -> SpacesScreen(api) { open(Screen.SpaceSnaps(it)) }
                is Screen.SpaceSnaps -> SpaceSnapsScreen(api, screen.space, ::open)
                is Screen.SnapDetail -> SnapDetailScreen(api, screen.snap)
                is Screen.Flashcards -> FlashcardsScreen(api, screen.space)
                is Screen.QuizScreen -> QuizScreen(api, screen.space)
                Screen.Feed -> FeedScreen(api)
            }
        }
    }
}

/** A scrolling screen that follows the round display. */
@Composable
fun WatchList(page: Any? = null, content: ScalingLazyListScope.() -> Unit) {
    // A new page (e.g. the next quiz question) starts at the top.
    val state = remember(page) { ScalingLazyListState() }
    ScreenScaffold(scrollState = state) { contentPadding ->
        ScalingLazyColumn(
            state = state,
            contentPadding = contentPadding,
            modifier = Modifier.fillMaxWidth(),
            content = content,
        )
    }
}

@Composable
fun errorText(error: Throwable): String {
    val code = (error as? ApiException)?.code
    return stringResource(
        when (code) {
            "INVALID_CREDENTIALS" -> R.string.error_INVALID_CREDENTIALS
            "NETWORK_ERROR" -> R.string.error_NETWORK_ERROR
            "UNAUTHENTICATED" -> R.string.error_UNAUTHENTICATED
            "NO_ANALYZED_SNAPS" -> R.string.error_NO_ANALYZED_SNAPS
            else -> R.string.error_UNKNOWN_ERROR
        },
    )
}

/** Loading, error (with retry) or the data of a request. */
sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Failed(val error: Throwable) : Load<Nothing>
    data class Ready<T>(val data: T) : Load<T>
}

@Composable
fun <T> rememberLoad(vararg keys: Any?, load: suspend () -> T): Pair<Load<T>, () -> Unit> {
    var attempt by remember { mutableIntStateOf(0) }
    val state by produceState<Load<T>>(Load.Loading, *keys, attempt) {
        value = Load.Loading
        value = try {
            Load.Ready(load())
        } catch (error: Exception) {
            Load.Failed(error)
        }
    }
    return state to { attempt += 1 }
}

fun ScalingLazyListScope.loadState(load: Load<*>, retry: () -> Unit) {
    when (load) {
        Load.Loading -> item { CircularProgressIndicator(modifier = Modifier.size(32.dp)) }
        is Load.Failed -> {
            item { Text(errorText(load.error), textAlign = TextAlign.Center) }
            item { FilledTonalButton(onClick = retry, label = { Text(stringResource(R.string.retry)) }) }
        }
        is Load.Ready -> Unit
    }
}

/** A one-line text field; the watch keyboard opens over it. No autocorrect: these are credentials. */
@Composable
fun Field(label: String, value: String, password: Boolean = false, onChange: (String) -> Unit) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.labelSmall)
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = if (password) KeyboardType.Password else KeyboardType.Email,
                imeAction = ImeAction.Done,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outline), RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp),
        )
    }
}

@Composable
fun LoginScreen(api: SnapiaApi, onSignedIn: () -> Unit) {
    val scope = rememberCoroutineScope()
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<Throwable?>(null) }

    WatchList {
        item { ListHeader { Text(stringResource(R.string.app_name)) } }
        item {
            Text(
                stringResource(R.string.tagline),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
            )
        }
        item { Field(stringResource(R.string.login_user), identifier) { identifier = it } }
        item { Field(stringResource(R.string.login_password), password, password = true) { password = it } }
        error?.let { item { Text(errorText(it), textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.error) } }
        item {
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        try {
                            api.login(identifier, password)
                            onSignedIn()
                        } catch (failure: Exception) {
                            error = failure
                        } finally {
                            busy = false
                        }
                    }
                },
                enabled = !busy && identifier.isNotBlank() && password.isNotEmpty(),
                modifier = Modifier.fillMaxWidth(),
                label = { Text(if (busy) stringResource(R.string.loading) else stringResource(R.string.login_submit)) },
            )
        }
    }
}

@Composable
fun MenuScreen(open: (Screen) -> Unit, onLogout: () -> Unit) {
    WatchList {
        item { ListHeader { Text(stringResource(R.string.app_name)) } }
        item {
            Button(onClick = { open(Screen.Spaces) }, modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.menu_spaces)) })
        }
        item {
            Button(onClick = { open(Screen.Feed) }, modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.menu_feed)) })
        }
        item {
            FilledTonalButton(onClick = onLogout, modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.menu_logout)) })
        }
    }
}

fun modeLabel(mode: String): Int = when (mode) {
    "STUDY" -> R.string.mode_STUDY
    "WORK" -> R.string.mode_WORK
    else -> R.string.mode_CONTENT
}

fun statusLabel(status: String): Int = when (status) {
    "PENDING" -> R.string.status_PENDING
    "PROCESSING" -> R.string.status_PROCESSING
    "DONE" -> R.string.status_DONE
    else -> R.string.status_FAILED
}

@Composable
fun SpacesScreen(api: SnapiaApi, onOpen: (Space) -> Unit) {
    val (load, retry) = rememberLoad { api.spaces() }
    WatchList {
        item { ListHeader { Text(stringResource(R.string.menu_spaces)) } }
        loadState(load, retry)
        if (load is Load.Ready) {
            if (load.data.isEmpty()) item { Text(stringResource(R.string.spaces_empty), textAlign = TextAlign.Center) }
            items(load.data) { space ->
                Button(
                    onClick = { onOpen(space) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(space.name, maxLines = 2) },
                    secondaryLabel = {
                        Text(stringResource(R.string.space_meta, stringResource(modeLabel(space.mode)), pluralStringResource(R.plurals.snap_count, space.snapCount, space.snapCount)))
                    },
                )
            }
        }
    }
}

@Composable
fun RemoteImage(api: SnapiaApi, url: String, modifier: Modifier = Modifier, description: String? = null) {
    val bitmap by produceState<android.graphics.Bitmap?>(null, url) { value = api.image(url) }
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = description,
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize(),
            )
        } ?: CircularProgressIndicator(modifier = Modifier.size(24.dp))
    }
}

@Composable
fun SpaceSnapsScreen(api: SnapiaApi, space: Space, open: (Screen) -> Unit) {
    val (load, retry) = rememberLoad(space.id) { api.snaps(space.id) }
    WatchList {
        item { ListHeader { Text(space.name, maxLines = 2, textAlign = TextAlign.Center) } }
        if (space.mode == "STUDY") {
            item {
                Button(onClick = { open(Screen.Flashcards(space)) }, modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.flashcards)) })
            }
            item {
                Button(onClick = { open(Screen.QuizScreen(space)) }, modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.quiz)) })
            }
        }
        loadState(load, retry)
        if (load is Load.Ready) {
            if (load.data.isEmpty()) item { Text(stringResource(R.string.snaps_empty), textAlign = TextAlign.Center) }
            items(load.data) { snap ->
                Card(onClick = { open(Screen.SnapDetail(snap)) }, modifier = Modifier.fillMaxWidth()) {
                    RemoteImage(
                        api,
                        snap.thumbnailUrl,
                        description = stringResource(R.string.snap_photo),
                        modifier = Modifier.fillMaxWidth().size(110.dp).clip(RoundedCornerShape(12.dp)),
                    )
                    Text(stringResource(statusLabel(snap.status)), style = MaterialTheme.typography.labelSmall)
                }
            }
            item {
                FilledTonalButton(onClick = retry, modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.refresh)) })
            }
        }
    }
}

@Composable
fun SnapDetailScreen(api: SnapiaApi, snap: Snap) {
    val (load, retry) = rememberLoad(snap.id) { api.insight(snap.id) }
    WatchList {
        item {
            RemoteImage(
                api,
                snap.thumbnailUrl,
                description = stringResource(R.string.snap_photo),
                modifier = Modifier.size(120.dp).clip(CircleShape),
            )
        }
        snap.note?.let { item { Text(it, style = MaterialTheme.typography.labelSmall) } }
        loadState(load, retry)
        if (load is Load.Ready) {
            if (load.data.isEmpty()) {
                item { Text(stringResource(statusLabel(snap.status)), textAlign = TextAlign.Center) }
                item { Text(stringResource(R.string.insight_none), textAlign = TextAlign.Center) }
            }
            items(load.data) { section ->
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
                    section.titleRes?.let {
                        Text(stringResource(it), style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.primary)
                    }
                    Text(section.text, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun FlashcardsScreen(api: SnapiaApi, space: Space) {
    val (load, retry) = rememberLoad(space.id) { api.flashcards(space.id) }
    var index by remember { mutableIntStateOf(0) }
    var flipped by remember { mutableStateOf(false) }
    WatchList {
        item { ListHeader { Text(stringResource(R.string.flashcards)) } }
        if (load is Load.Loading) item { Text(stringResource(R.string.generating), textAlign = TextAlign.Center) }
        loadState(load, retry)
        if (load is Load.Ready) {
            val card = load.data.getOrNull(index)
            if (card != null) {
                item { Text(stringResource(R.string.card_position, index + 1, load.data.size), style = MaterialTheme.typography.labelSmall) }
                item {
                    Card(
                        onClick = { flipped = !flipped },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            stringResource(if (flipped) R.string.card_answer else R.string.card_question),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(if (flipped) card.answer else card.question, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                item { Text(stringResource(R.string.card_hint), style = MaterialTheme.typography.labelSmall) }
                item {
                    Button(
                        onClick = { index = (index + 1) % load.data.size; flipped = false },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.next)) },
                    )
                }
                item {
                    FilledTonalButton(
                        onClick = { index = (index - 1 + load.data.size) % load.data.size; flipped = false },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.previous)) },
                    )
                }
            }
        }
    }
}

@Composable
fun QuizScreen(api: SnapiaApi, space: Space) {
    val scope = rememberCoroutineScope()
    var round by remember { mutableIntStateOf(0) }
    val (load, retry) = rememberLoad(space.id, round) { api.quiz(space.id) }
    val answers = remember(round) { mutableStateListOf<Int>() }
    var score by remember(round) { mutableStateOf<Int?>(null) }
    var error by remember(round) { mutableStateOf<Throwable?>(null) }

    WatchList(page = "$round-${answers.size}-${score != null}") {
        item { ListHeader { Text(stringResource(R.string.quiz)) } }
        if (load is Load.Loading) item { Text(stringResource(R.string.generating), textAlign = TextAlign.Center) }
        loadState(load, retry)
        if (load is Load.Ready) {
            val quiz = load.data
            val current = quiz.questions.getOrNull(answers.size)
            val finalScore = score
            if (finalScore != null) {
                item {
                    Text(
                        stringResource(R.string.quiz_score, finalScore, quiz.questions.size),
                        style = MaterialTheme.typography.titleLarge,
                        textAlign = TextAlign.Center,
                    )
                }
                item {
                    Button(onClick = { round += 1 }, modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.quiz_again)) })
                }
            } else if (current != null) {
                item {
                    Text(stringResource(R.string.quiz_question, answers.size + 1, quiz.questions.size),
                        style = MaterialTheme.typography.labelSmall)
                }
                item { Text(current.prompt, textAlign = TextAlign.Center) }
                items(current.options.withIndex().toList()) { (optionIndex, option) ->
                    FilledTonalButton(
                        onClick = {
                            answers.add(optionIndex)
                            if (answers.size == quiz.questions.size) {
                                scope.launch {
                                    try {
                                        score = api.answerQuiz(quiz.id, answers.toList())
                                    } catch (failure: Exception) {
                                        error = failure
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(option, maxLines = 3) },
                    )
                }
            } else {
                item { CircularProgressIndicator(modifier = Modifier.size(32.dp)) }
            }
            error?.let { item { Text(errorText(it), color = MaterialTheme.colorScheme.error) } }
        }
    }
}

@Composable
fun FeedScreen(api: SnapiaApi) {
    val (load, retry) = rememberLoad { api.feed() }
    WatchList {
        item { ListHeader { Text(stringResource(R.string.menu_feed)) } }
        loadState(load, retry)
        if (load is Load.Ready) {
            if (load.data.isEmpty()) item { Text(stringResource(R.string.feed_empty), textAlign = TextAlign.Center) }
            items(load.data) { post -> PostItem(api, post) }
        }
    }
}

@Composable
fun PostItem(api: SnapiaApi, post: Post) {
    val scope = rememberCoroutineScope()
    var liked by remember(post.id) { mutableStateOf(post.likedByMe) }
    var likes by remember(post.id) { mutableIntStateOf(post.likesCount) }
    LaunchedEffect(post.id) { liked = post.likedByMe; likes = post.likesCount }

    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("@${post.author}", style = MaterialTheme.typography.labelMedium)
        post.imageUrl?.let { url ->
            RemoteImage(
                api,
                url,
                description = stringResource(R.string.snap_photo),
                modifier = Modifier
                    .fillMaxWidth()
                    .size(130.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .pointerInput(post.id) {
                        detectTapGestures(onDoubleTap = {
                            if (!liked) {
                                scope.launch {
                                    runCatching { api.toggleLike(post.id) }.onSuccess { (isLiked, count) ->
                                        liked = isLiked
                                        likes = count
                                    }
                                }
                            }
                        })
                    },
            )
        }
        Text(
            stringResource(if (liked) R.string.likes_liked else R.string.likes, likes),
            style = MaterialTheme.typography.labelMedium,
            color = if (liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
        )
        Text(stringResource(R.string.like_hint), style = MaterialTheme.typography.labelSmall)
        if (post.caption.isNotBlank()) Text(post.caption, style = MaterialTheme.typography.bodySmall, maxLines = 4)
    }
}
