import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Page from './page'

describe('Home Page', () => {
  it('renders without crashing', () => {
    render(<Page />)
    expect(document.body).toBeTruthy()
  })
})