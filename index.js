import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "booknote",
  password: "admin",
  port: 5432,
});
db.connect();

async function findBookList() {
  const result = await db.query("SELECT * FROM book_detail");
  let items = result.rows;
  return items;
}

async function SortBookList(sortBy, sortOrder) {
  const result = await db.query(`SELECT * FROM book_detail ORDER BY ${sortBy} ${sortOrder}`);
  let items = result.rows;
  return items;
}

async function findQuoteList(req,res) {
  const currentBookTitle = await findCurrentTitle(req);
  const result = await db.query("SELECT * FROM quotes WHERE title = $1 ORDER BY id ASC ",
  [currentBookTitle]);
  let items = result.rows;
  return items;
}

async function findCurrentTitle(req,res) {
  return req.params.title;
}

async function bookCreate(req,res) {
    var bookIntro = req.body.bookIntro;
    bookIntro = bookIntro.replace(/\r\n/g, '<br>');
    const bookTitle = req.body.bookTitle;
    const bookAuthor = req.body.bookAuthor;
    const bookDate = req.body.bookDate;
    var bookRating = req.body.bookRating;
    bookRating = Number(bookRating);
    const bookISBN = req.body.bookISBN;
    try {
      await db.query(
        "INSERT INTO book_detail (title, author, date_read, rating, isbn, notes) VALUES ($1, $2, $3, $4, $5, $6 )",
        [bookTitle, bookAuthor, bookDate, bookRating, bookISBN, bookIntro]
      );
      const url = `books/${bookTitle}`;
      res.redirect("/"+url);
    } catch (err) {
      console.log(err);}
}

app.get("/", async (req, res) => {
  const items = await findBookList();
  console.log(items);
  res.render("index.ejs", {
    listTitle: "My Book Notes",
    listItems: items,
  });
});

app.get("/sort", async (req, res) => {
  let sortBy = req.query.sortBy || 'date_read'; // Default sort by date
  let sortOrder = req.query.sortOrder || 'asc'; // Default sort order ascending

  try {
    const items = await SortBookList(sortBy, sortOrder);
    console.log(items);
    res.render('index.ejs', {
    listTitle: "My Book Notes",
    listItems: items, 
    });
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/books/:title", async(req, res) => {
  const items = await findBookList();
  const currentBook = items.find(currentBook => currentBook.title === req.params.title);
  if (!currentBook) {
    res.status(404).send('Book not found');
    return;
}
  const currentQuotes = await findQuoteList(req);
  const imgUrl = `https://covers.openlibrary.org/b/isbn/${currentBook.isbn}-M.jpg`;
  console.log(currentBook.isbn);
  res.render("template.ejs", {currentBook: currentBook, currentQuotes: currentQuotes, img: imgUrl});
}); 

app.post("/submit", async (req, res) => {
  await bookCreate(req,res);
});

app.get("/add", (req, res) => {
  res.render("addpost.ejs");
});

app.post("/edit", async (req, res) => {  
  const inputID = req.body.bookId;
  const inputTitle = req.body.bookTitle;
  const inputAuthor = req.body.bookAuthor;
  const inputRating = req.body.bookRating;
  const inputDate = req.body.bookDate;
  const inputIntro = req.body.bookIntro;
  const inputISBN = req.body.bookISBN;
  const items = await findBookList();
  const currentBook = items.find(currentBook => currentBook.id == inputID);
  const oldTitle = currentBook.title;
  console.log(oldTitle);
  try {
    await db.query(
      "UPDATE book_detail SET title = $1, author = $2, rating = $3, date_read = $4, notes = $5, isbn = $6 WHERE id = $7",
      [inputTitle, inputAuthor, inputRating, inputDate, inputIntro, inputISBN, inputID]
    );
    await db.query(
      "UPDATE quotes SET title = $1 WHERE title = $2",
      [inputTitle, oldTitle]
    );
    res.redirect('books/' + encodeURIComponent(inputTitle));
  } catch (err) {
    console.log(err);}
});

app.get("/edit/:title", async(req, res) => {
  const items = await findBookList();
  const currentBook = items.find(currentBook => currentBook.title === req.params.title);
  if (!currentBook) {
    res.status(404).send('Book not found');
    return;
  }
    res.render("editpost.ejs",{
      currentBook: currentBook
    });
});

app.post("/add_quote", async (req, res) => {
  const inputQuote = req.body.newItem;
  const currentBookTitle = req.body.list;
    try {
      await db.query(
        "INSERT INTO quotes (title, quotes) VALUES ($1, $2)",
        [currentBookTitle, inputQuote]
      );
      const referer = req.headers.referer || "/";
      res.redirect(referer);
    } catch (err) {
      console.log(err);}
});

app.post("/edit_quote", async (req, res) => {  
  const inputID = req.body.updatedItemId;
  const inputQuote = req.body.updatedItemQuote;
  try {
    await db.query(
      "UPDATE quotes SET quotes = $1 WHERE id = $2",
      [inputQuote, inputID]
    );
    const referer = req.headers.referer || "/";
    res.redirect(referer);
  } catch (err) {
    console.log(err);
}});

app.post("/delete", async (req, res) => {
  const inputID = req.body.deleteItemId;
  try {
    const result = await db.query(
      "SELECT title FROM book_detail WHERE id = $1",
      [inputID]
    );
    const deletedTitle = result.rows;
    await db.query(
      "DELETE FROM quotes WHERE title = $1",
      [deletedTitle[0].title]
    );
    await db.query(
      "DELETE FROM book_detail WHERE id = $1",
      [inputID]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
}
});

app.post("/delete_quote", async (req, res) => {
  const inputID = req.body.deleteQuoteId;
  console.log(req.body);
  try {
    await db.query(
      "DELETE FROM quotes WHERE id = $1",
      [inputID]
    );
    const referer = req.headers.referer || "/";
    res.redirect(referer);
  } catch (err) {
    console.log(err);
}
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
