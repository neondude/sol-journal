import React from "react"
import { addDays, subDays, format, isAfter, startOfYesterday } from "date-fns"
import { BeatLoader } from "react-spinners"
import styled from "@emotion/styled"
/** @jsx jsx */
import { jsx, css, keyframes } from "@emotion/core"
import { compose } from "recompose"
import { withTheme } from "emotion-theming"

import { withFirebase } from "components/firebase"
import { withAuthentication } from "components/session"
import { OnlineContext } from "components/context/online"

import { SIZES } from "styles/constants"

import Seek from "components/Seek"
import Icon from "components/Icon"

const EntryHeading = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: ${SIZES.medium};
`
const EntryInfo = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`
const JournalHeading = styled.h2`
  font-weight: 700;
  font-size: ${SIZES.tiny};
  color: ${(props) => props.theme.colors.secondary};
  display: block;
`
const SavedMessaged = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  grid-gap: 5px;
  color: ${(props) => props.theme.colors.secondary};
  font-size: ${SIZES.tiny};
  user-select: none;
`
const OfflineNotice = styled.div`
  padding: 5px;
  color: ${(props) => props.theme.colors.secondary};
  border: 1px solid;
  border-color: ${(props) => props.theme.colors.tertiary};
  font-size: ${SIZES.tiny};
  border-radius: 3px;
`
const JournalEntryArea = styled.textarea`
  font-family: sans-serif;
  flex-grow: 0.85;
  color: ${(props) => props.theme.colors.primary};
  caret-color: ${(props) => props.theme.colors.secondary};
  background-color: transparent;
  line-height: 1.5;
  letter-spacing: 0.5px;
  height: calc(100vh - 300px);
  width: 100%;
  border: none;
  resize: none;
  outline: none;
  font-size: ${SIZES.small};
  border-radius: 1px;
  margin-top: ${SIZES.tiny};
  padding-top: 0px;
  padding-bottom: 0px;
  &::placeholder {
    color: ${(props) => props.theme.colors.tertiary};
  }
  &::selection {
    background: ${(props) => props.theme.colors.hover};
  }
  &:focus {
    box-shadow: 0 0 0 8px ${(props) => props.theme.colors.bodyBackground},
      0 0 0 10px ${(props) => props.theme.colors.hover};
  }
`
const Buttons = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: 20px;
`
const fadeKeyFrames = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`
const LoadingSpinner = styled(BeatLoader)`
  opacity: 0;
`

const AUTOSAVE_DELAY = 2000

class Day extends React.Component {
  state = {
    text: "",
    loading: true,
    saving: false,
    lastSavedAt: new Date(),
    lastEditedAt: new Date(),
  }
  timeout = 0

  static contextType = OnlineContext

  componentDidMount() {
    const { year, month, day } = this.props
    this.getDocRef(year, month, day, false)
  }

  componentDidUpdate(prevProps) {
    // check if a new route was hit, to save the entry and load the next one
    if (this.props.uri !== prevProps.uri) {
      const [
        ,
        ,
        prevYear,
        prevMonth,
        prevDay,
      ] = prevProps.location.pathname.split("/")
      const { text } = this.state
      this.saveText(text, prevYear, prevMonth, prevDay)
      const [, , year, month, day] = this.props.location.pathname.split("/")
      this.onRouteChanged(year, month, day)
    }
  }

  onRouteChanged = (year, month, day) => {
    this.setState({ loading: true })
    this.getDocRef(year, month, day, false)
  }

  getDocRef = (year, month, day, cacheFirst) => {
    const { firebase, authUser } = this.props
    const getOptions = {
      source: cacheFirst ? "cache" : "default",
    }
    const docRef = firebase.db
      .collection("entries")
      .doc(`${year}${month}${day}-${authUser.uid}`)
    this.getData(docRef, getOptions)
  }

  getData = (docRef, options) => {
    docRef
      .get(options)
      .then((doc) => {
        if (doc.data()) {
          this.setState({ text: doc.data().text, loading: false })
        } else {
          this.setState({ text: "", loading: false })
        }
      })
      .catch((err) => {
        console.warn("entry not found in cache")
        // no doc was found, so reset the entry area to blank
        this.setState({ loading: false, text: "" })
        // for cache first, server second fetching, dangerous with potential overwriting of data
        // docRef.get().then(doc => {
        //   if (doc.data()) {
        //     this.setState({ text: doc.data().text, loading: false });
        //   } else {
        //     this.setState({ text: "", loading: false });
        //   }
        // });
      })
  }

  onChangeText = (e) => {
    if (this.timeout) clearTimeout(this.timeout)
    const text = e.target.value
    const { year, month, day } = this.props

    this.setState({ text, lastEditedAt: new Date() })
    this.timeout = setTimeout(() => {
      this.saveText(text, year, month, day)
    }, AUTOSAVE_DELAY)
  }

  onInsertTime = () => {
    const entryTextArea = document.getElementById("entry-text-area")
    const cursorIndex = entryTextArea.selectionStart
    const { text } = this.state
    const { year, month, day } = this.props
    const insertAt = (str, sub, pos) =>
      `${str.slice(0, pos)}${sub}${str.slice(pos)}`
    const newText = insertAt(text, format(new Date(), "HH:mm "), cursorIndex)
    this.setState({
      text: newText,
    })
    entryTextArea.focus()
    this.saveText(newText, year, month, day)
  }

  saveText = (text, year, month, day) => {
    this.setState({ saving: true })
    const { firebase, authUser } = this.props
    firebase.db
      .collection("entries")
      .doc(`${year}${month}${day}-${authUser.uid}`)
      .set(
        {
          text,
          day: Number(day),
          year: Number(year),
          month: Number(month),
          userId: authUser.uid,
        },
        {
          merge: true,
        }
      )
      .then(() => {
        this.setState({ saving: false, lastSavedAt: new Date() })
      })
      .catch(() => {
        console.warn("saving will occur when back online")
        this.setState({ saving: false })
      })
  }

  render() {
    const { year, month, day, theme } = this.props
    const online = this.context
    const { text, loading, saving, lastSavedAt, lastEditedAt } = this.state
    const currentDay = new Date(year, month - 1, day)
    if (!currentDay) return
    const hasSavedChanges = lastSavedAt >= lastEditedAt

    return (
      <>
        <Seek
          title={format(currentDay, "YYYY MMM DD - dddd")}
          prev={format(subDays(currentDay, 1), "/YYYY/MM/DD")}
          next={format(addDays(currentDay, 1), "/YYYY/MM/DD")}
          disableNext={isAfter(currentDay, startOfYesterday())}
        />
        <EntryHeading>
          <JournalHeading>Record thoughts about the day</JournalHeading>
          <EntryInfo>
            {online && (
              <SavedMessaged>
                {saving ? (
                  <>
                    Saving
                    <LoadingSpinner
                      color={theme.colors.quarternary}
                      size={5}
                      css={css`
                        animation: 1s ease-in;
                      `}
                    />
                  </>
                ) : hasSavedChanges ? (
                  `Last saved at ${format(lastSavedAt, "h:mma")}`
                ) : (
                  "Unsaved changes"
                )}
              </SavedMessaged>
            )}
            {!online && <OfflineNotice>Offline</OfflineNotice>}
          </EntryInfo>
        </EntryHeading>
        {loading ? (
          <div style={{ marginTop: 10 }}>
            <LoadingSpinner
              color={theme.colors.quarternary}
              size={10}
              margin="4px"
              css={css`
                animation: ${fadeKeyFrames} 1s ease-in;
              `}
            />
          </div>
        ) : (
          <>
            <JournalEntryArea
              id="entry-text-area"
              autoFocus={true}
              placeholder="Start writing..."
              onChange={(e) => this.onChangeText(e)}
              value={text}
              css={css`
                animation: ${fadeKeyFrames} 0.2s ease-in;
              `}
            />
            <Buttons>
              <Icon
                name="Clock"
                label="Quick Add Time"
                labelRight
                onClick={() => this.onInsertTime()}
              />{" "}
            </Buttons>
          </>
        )}
      </>
    )
  }
}

export default compose(withFirebase, withTheme, withAuthentication)(Day)
